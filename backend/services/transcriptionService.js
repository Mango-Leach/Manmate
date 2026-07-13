const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

const TEMP_DIR = path.join(__dirname, '..', '..', 'tmp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
const FAILED_DIR = path.join(TEMP_DIR, 'failed');
if (!fs.existsSync(FAILED_DIR)) fs.mkdirSync(FAILED_DIR, { recursive: true });

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_API_URL = process.env.SARVAM_API_URL || 'https://api.sarvam.ai/v1/stt';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'medium'; // local model size

async function saveBase64ToFile(base64, filename) {
  const buffer = Buffer.from(base64, 'base64');
  const outPath = path.join(TEMP_DIR, `${Date.now()}_${filename}`);
  await fs.promises.writeFile(outPath, buffer);
  return outPath;
}

async function transcribeWithWhisper(filePath, options = {}) {
  // Options: { model: 'small'|'medium'|'large' } — uses local CLI whisper
  const model = options.model || WHISPER_MODEL;
  const saveFailedDebugCopy = async (target) => {
    try {
      if (!target || !fs.existsSync(target)) return null;
      const failedCopy = path.join(FAILED_DIR, `${path.basename(target)}_${Date.now()}`);
      await fs.promises.copyFile(target, failedCopy);
      logger.info('Saved failed audio for debugging:', failedCopy);
      return failedCopy;
    } catch (copyErr) {
      logger.warn('Failed to save audio for debugging:', copyErr?.message || copyErr);
      return null;
    }
  };

  const extractExecErrorDetails = (err) => {
    if (!err) return 'unknown error';
    const parts = [];
    if (err.message) parts.push(`message=${err.message}`);
    if (typeof err.code !== 'undefined') parts.push(`code=${err.code}`);
    if (err.signal) parts.push(`signal=${err.signal}`);
    if (err.killed) parts.push(`killed=${err.killed}`);
    if (typeof err.stdout === 'string' && err.stdout.trim()) parts.push(`stdout=${err.stdout.trim().slice(0, 800)}`);
    if (typeof err.stderr === 'string' && err.stderr.trim()) parts.push(`stderr=${err.stderr.trim().slice(0, 800)}`);
    if (!parts.length) {
      try {
        return JSON.stringify(err);
      } catch (e) {
        return String(err);
      }
    }
    return parts.join(' | ');
  };
  try {
    // Basic sanity check: file exists and has non-trivial size
    let stat = null;
    try { stat = await fs.promises.stat(filePath); } catch (e) { stat = null; }
    if (!stat || stat.size < 1024) {
      logger.warn('Whisper: input file missing or too small for transcription', { filePath, size: stat ? stat.size : 0 });
      return { text: '', confidence: 0, language: null, model: null, error: new Error('input file missing or too small') };
    }
    // Use Python whisper module for more reliable local transcription.
    // Create a small Python runner script and execute it.
    const runnerPath = path.join(TEMP_DIR, `whisper_runner_${Date.now()}.py`);
    const runnerCode = `import sys, json
try:
    import whisper
except Exception as e:
    print(json.dumps({"error":"import_failed","message":str(e)}))
    sys.exit(2)
model_name = sys.argv[1]
file_path = sys.argv[2]
try:
    model = whisper.load_model(model_name)
    res = model.transcribe(file_path)
    segments = []
    for s in res.get("segments", []):
        segments.append({
            "id": int(s.get("id", 0)),
            "start": float(s.get("start", 0)),
            "end": float(s.get("end", 0)),
            "text": str(s.get("text", "")).strip()
        })
    output = {
        "text": str(res.get("text", "")),
        "language": str(res.get("language", "")),
        "segments": segments
    }
    print(json.dumps(output))
except Exception as e:
    print(json.dumps({"error":"transcribe_failed","message":str(e)}))
    sys.exit(3)
`;

    fs.writeFileSync(runnerPath, runnerCode, 'utf8');
    // Find a python executable available on PATH
    const pythonCandidates = ['python', 'python3', 'py'];
    let pythonExe = null;
    for (const cand of pythonCandidates) {
      try {
        await execFileAsync(cand, ['--version']);
        pythonExe = cand;
        break;
      } catch (e) {
        // try next
      }
    }
    if (!pythonExe) throw new Error('No python executable found on PATH');

    // Explicitly add FFmpeg bin folder to PATH for whisper to find ffmpeg
    const ffmpegBinPath = path.join(__dirname, '..', '..', 'bin');
    const envPath = process.env.PATH ? `${ffmpegBinPath}${path.delimiter}${process.env.PATH}` : ffmpegBinPath;
    const env = { ...process.env, PATH: envPath };

    // Convert to a WAV file first to avoid format edge-cases (webm/opus etc.)
    const convertedPath = path.join(TEMP_DIR, `conv_${Date.now()}.wav`);
    try {
      // ffmpeg -y -i input -ar 16000 -ac 1 output.wav
      logger.info('Converting audio to WAV for Whisper', { filePath, convertedPath });
      await execFileAsync(path.join(ffmpegBinPath, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'), ['-y', '-i', filePath, '-ar', '16000', '-ac', '1', convertedPath], { env, timeout: 120000 });
      logger.info('Conversion complete', { convertedPath, size: (await fs.promises.stat(convertedPath)).size });
    } catch (convErr) {
      logger.warn('Audio conversion to WAV failed, proceeding with original file', convErr.message || convErr);
      try { if (fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath); } catch(e){}
    }

    const targetPath = fs.existsSync(convertedPath) ? convertedPath : filePath;

    try {
      logger.info('Starting Python whisper transcription...', { pythonExe, model, targetPath, ffmpegBinPath });
      const { stdout, stderr } = await execFileAsync(pythonExe, [runnerPath, model, targetPath], {
        timeout: 300000,
        env: env
      });
      if (stderr) logger.info('Python stderr output:', stderr);
      if (!stdout) throw new Error('No output from python whisper runner');
      logger.info('Python whisper runner output received');
      let result = null;
      try { result = JSON.parse(stdout); } catch (e) { throw new Error('Invalid JSON from whisper runner: ' + e.message); }

      if (result && result.error) {
        const failedAudioPath = await saveFailedDebugCopy(targetPath);
        logger.error('Python whisper runner error:', result.message || result.error);
        // fall through to return empty result
        return { text: '', confidence: 0, language: null, model: null, error: result, failedAudioPath };
      }

      const text = result.text || '';
      const language = result.language || null;
      const segments = Array.isArray(result.segments) ? result.segments : [];
      const confidence = text.length > 0 ? Math.min(1.0, 0.85 + (language ? 0.05 : 0)) : 0;

      // If whisper returned empty, attempt a retry with a smaller model
      if (!text || text.trim().length === 0) {
        logger.warn('Whisper returned empty text; attempting retry with small model');
        try {
          const retryModel = 'small';
          const { stdout: s2 } = await execFileAsync(pythonExe, [runnerPath, retryModel, targetPath], { timeout: 180000, env });
          let r2 = null;
          try { r2 = JSON.parse(s2); } catch (e) { r2 = null; }
          const text2 = (r2 && r2.text) || '';
          if (text2 && text2.trim().length > 0) {
            logger.info('Retry whisper (small) succeeded with non-empty text');
            return { text: text2, segments: Array.isArray(r2.segments) ? r2.segments : [], confidence: r2.confidence || 0, language: r2.language || null, model: 'whisper-small' };
          }
        } catch (retryErr) {
          logger.warn('Retry whisper failed:', extractExecErrorDetails(retryErr));
        }
        // Both attempts returned empty — save the audio for debugging
        const failedAudioPath = await saveFailedDebugCopy(targetPath);
        return {
          text: '',
          segments: [],
          confidence: 0,
          language,
          model: `whisper-${model}`,
          failedAudioPath,
        };
      }

      return {
        text,
        segments,
        confidence,
        language,
        model: `whisper-${model}`,
      };
    } finally {
      try { fs.unlinkSync(runnerPath); } catch (e) { /* noop */ }
      try { if (fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath); } catch (e) { /* noop */ }
    }
  } catch (err) {
    const failedAudioPath = await saveFailedDebugCopy(filePath);
    logger.error('Whisper local transcription failed:', extractExecErrorDetails(err));
    return { text: '', confidence: 0, language: null, model: null, error: err, failedAudioPath };
  }
}

async function transcribeWithSarvam(filePath, options = {}) {
  if (!SARVAM_API_KEY) {
    logger.warn('SARVAM_API_KEY not configured — skipping Sarvam API call');
    return { text: '', confidence: 0, language: null, model: null };
  }
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    // Additional params could include language hints
    const resp = await axios.post(SARVAM_API_URL, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${SARVAM_API_KEY}`,
      },
      timeout: 120000,
    });
    const data = resp.data || {};
    return {
      text: data.transcript || data.text || '',
      confidence: data.confidence ?? 0,
      language: data.language || null,
      model: data.model || 'sarvam',
      raw: data,
    };
  } catch (err) {
    logger.error('Sarvam transcription failed:', err?.response?.data || err.message);
    return { text: '', confidence: 0, language: null, model: null, error: err };
  }
}

async function createGoogleDoc(transcriptText, metadata = {}) {
  // Create a Google Doc if credentials are configured. This is optional.
  // Requires service account or OAuth2 setup (GOOGLE_CLIENT_ID/SECRET and refresh token).
  // We'll return null if Google credentials are not configured.
  try {
    const { google } = require('googleapis');
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!clientEmail || !privateKey) {
      return null;
    }
    const scopes = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file'];
    const jwtClient = new google.auth.JWT(clientEmail, null, (privateKey || '').replace(/\\n/g, '\n'), scopes);
    const docs = google.docs({ version: 'v1', auth: jwtClient });
    const drive = google.drive({ version: 'v3', auth: jwtClient });

    const title = metadata.title || `Transcript ${new Date().toISOString()}`;
    const createRes = await docs.documents.create({ requestBody: { title } });
    const docId = createRes.data.documentId;
    // Write transcript content
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{ insertText: { text: transcriptText, location: { index: 1 } } }],
      },
    });
    // Make sure file is accessible to owner's drive
    await drive.permissions.create({ fileId: docId, requestBody: { role: 'owner', type: 'user', emailAddress: clientEmail } }).catch(() => {});
    return { docId };
  } catch (err) {
    logger.warn('Google Doc creation skipped or failed:', err.message);
    return null;
  }
}

module.exports = {
  saveBase64ToFile,
  transcribeWithWhisper,
  transcribeWithSarvam,
  createGoogleDoc,
};
