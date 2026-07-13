import { useState, useCallback, useRef } from 'react';
import { apiCall } from '../api';

interface TranscriptionResult {
  _id: string;
  sessionId: string;
  callId?: string;
  speaker: string;
  text: string;
  confidence: number;
  processor: string;
  model: string;
  createdAt: string;
}

interface UseTranscriptionOptions {
  sessionId: string;
  callId?: string;
  speaker?: 'client' | 'listener' | string;
  archiveToGoogle?: boolean;
}

export function useTranscription(options: UseTranscriptionOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('audio/webm');

  const pickMimeType = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return 'audio/webm';
  }, []);

  // Convert Blob to Base64
  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Start recording audio
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mimeTypeRef.current = mimeType;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recording';
      setError(msg);
    }
  }, [pickMimeType]);

  // Stop recording and send to backend
  const stopRecordingAndTranscribe = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<TranscriptionResult | null>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        try {
          setLoading(true);
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
          const audioBase64 = await blobToBase64(audioBlob);

          const result = await apiCall('/api/transcribe/upload', {
            method: 'POST',
            body: JSON.stringify({
              sessionId: options.sessionId,
              callId: options.callId || options.sessionId,
              speaker: options.speaker || 'unknown',
              filename: `audio_${Date.now()}.webm`,
              audioBase64,
              archiveToGoogle: options.archiveToGoogle || false,
            }),
          });

          if (!result.saved) {
            setError('Transcription failed');
            setLoading(false);
            resolve(null);
            return;
          }

          setTranscripts((prev) => [...prev, result.saved]);
          setLoading(false);
          resolve(result.saved);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transcription error';
          setError(msg);
          setLoading(false);
          resolve(null);
        }
      };

      mediaRecorder.stop();
      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    });
  }, [blobToBase64, options]);

  // Fetch transcripts for a session
  const fetchTranscripts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall(`/api/transcribe/session/${options.sessionId}`, {
        method: 'GET',
      });
      if (result.transcripts) {
        setTranscripts(result.transcripts);
      }
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch transcripts';
      setError(msg);
      setLoading(false);
    }
  }, [options.sessionId]);

  return {
    loading,
    error,
    transcripts,
    startRecording,
    stopRecordingAndTranscribe,
    fetchTranscripts,
  };
}
