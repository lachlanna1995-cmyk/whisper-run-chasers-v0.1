package com.whisperrun.chasers;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;

import java.util.concurrent.atomic.AtomicBoolean;

final class MicMonitor {
    private static final int SAMPLE_RATE = 16000;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile double noiseLevel = 0.0;
    private AudioRecord recorder;
    private Thread worker;

    synchronized boolean start() {
        if (running.get()) return true;
        int min = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT);
        if (min <= 0) return false;
        try {
            recorder = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(min * 2, 4096));
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) return false;
            recorder.startRecording();
            running.set(true);
            worker = new Thread(this::loop, "whisper-mic");
            worker.start();
            return true;
        } catch (SecurityException | IllegalStateException ex) {
            stop();
            return false;
        }
    }

    private void loop() {
        short[] buffer = new short[1024];
        while (running.get() && recorder != null) {
            int count = recorder.read(buffer, 0, buffer.length);
            if (count <= 0) continue;
            double sum = 0;
            for (int i = 0; i < count; i++) {
                double n = buffer[i] / 32768.0;
                sum += n * n;
            }
            double rms = Math.sqrt(sum / count);
            double normalized = Math.max(0.0, Math.min(1.0, (rms - 0.006) / 0.16));
            noiseLevel = noiseLevel * 0.72 + normalized * 0.28;
        }
    }

    double getNoiseLevel() {
        return running.get() ? noiseLevel : 0.0;
    }

    synchronized void stop() {
        running.set(false);
        if (recorder != null) {
            try { recorder.stop(); } catch (Exception ignored) {}
            recorder.release();
            recorder = null;
        }
        worker = null;
        noiseLevel = 0.0;
    }
}
