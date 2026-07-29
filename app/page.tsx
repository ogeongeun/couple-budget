"use client";

import { useEffect, useRef, useState } from "react";

interface TranscriptionResult {
  text?: string;
}

interface SpeechPipeline {
  (
    audio: Float32Array,
    options?: {
      language?: string;
      task?: "transcribe" | "translate";
    },
  ): Promise<TranscriptionResult>;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);

  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState("");

  const [message, setMessage] = useState(
    "녹음 시작 버튼을 누르고 지출 내용을 말해보세요.",
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pipelineRef = useRef<SpeechPipeline | null>(null);

  useEffect(() => {
    return () => {
      stopMediaTracks();

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const getSupportedMimeType = () => {
    const mimeTypes = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];

    return (
      mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
    );
  };

  const loadWhisperModel = async (): Promise<SpeechPipeline> => {
    if (pipelineRef.current) {
      return pipelineRef.current;
    }

    setMessage(
      "Whisper 모델을 불러오고 있어요. 처음 한 번은 시간이 걸릴 수 있어요.",
    );

    /*
     * 브라우저에서만 라이브러리를 불러옵니다.
     * 서버에서 Whisper를 실행하는 것이 아니라 사용자의 기기에서 실행됩니다.
     */
    const { pipeline, env } = await import("@huggingface/transformers");

    /*
     * 로컬 프로젝트 파일이 아닌 Hugging Face 모델 저장소에서
     * 모델을 다운로드할 수 있도록 설정합니다.
     */
    env.allowLocalModels = false;

    const transcriber = (await pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-tiny",
      {
        dtype: "q8",
        device: "wasm",
      },
    )) as unknown as SpeechPipeline;

    pipelineRef.current = transcriber;
    setIsModelReady(true);

    return transcriber;
  };

  const startRecording = async () => {
    if (isTranscribing) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("이 브라우저에서는 마이크 녹음을 지원하지 않아요.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setMessage("이 브라우저에서는 녹음 기능을 지원하지 않아요.");
      return;
    }

    try {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl("");
      }

      setTranscript("");
      recordedBlobRef.current = null;
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      mediaStreamRef.current = stream;

      const mimeType = getSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);
        setMessage("녹음 중이에요. 지출 내용을 말해주세요.");

        timerRef.current = setInterval(() => {
          setRecordingTime((previous) => {
            const nextTime = previous + 1;

            /*
             * 테스트 중 너무 긴 음성이 들어가지 않도록
             * 최대 15초에서 자동 종료합니다.
             */
            if (nextTime >= 15) {
              mediaRecorderRef.current?.stop();
            }

            return nextTime;
          });
        }, 1000);
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error("녹음 오류:", event);

        setMessage("녹음 중 오류가 발생했어요.");
        setIsRecording(false);
        stopMediaTracks();
      };

      recorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const recordedType =
          recorder.mimeType || mimeType || "audio/webm";

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recordedType,
        });

        if (audioBlob.size === 0) {
          setMessage("녹음 파일이 비어 있어요. 다시 시도해주세요.");
          setIsRecording(false);
          stopMediaTracks();
          return;
        }

        recordedBlobRef.current = audioBlob;

        const newAudioUrl = URL.createObjectURL(audioBlob);

        setAudioUrl(newAudioUrl);
        setIsRecording(false);

        setMessage(
          `녹음 완료: ${Math.ceil(
            audioBlob.size / 1024,
          )}KB. 이제 텍스트 변환을 눌러주세요.`,
        );

        stopMediaTracks();
      };

      recorder.start();
    } catch (error) {
      console.error("마이크 실행 오류:", error);

      if (error instanceof DOMException) {
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          setMessage(
            "마이크 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.",
          );
        } else if (error.name === "NotFoundError") {
          setMessage("사용할 수 있는 마이크를 찾지 못했어요.");
        } else if (error.name === "NotReadableError") {
          setMessage("다른 프로그램이 마이크를 사용하고 있을 수 있어요.");
        } else {
          setMessage(`마이크 오류: ${error.name}`);
        }
      } else {
        setMessage("마이크를 실행하지 못했어요.");
      }

      setIsRecording(false);
      stopMediaTracks();
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    setMessage("녹음 파일을 만들고 있어요.");
    recorder.stop();
  };

  /**
   * 브라우저가 녹음한 mp4 또는 webm 파일을 디코딩하고,
   * Whisper가 사용하는 16kHz 단일 채널 Float32Array로 변환합니다.
   */
  const convertBlobTo16kHzAudio = async (
    blob: Blob,
  ): Promise<Float32Array> => {
    const arrayBuffer = await blob.arrayBuffer();

    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("이 브라우저는 오디오 변환을 지원하지 않습니다.");
    }

    const audioContext = new AudioContextClass();

    try {
      const decodedAudio = await audioContext.decodeAudioData(
        arrayBuffer.slice(0),
      );

      const targetSampleRate = 16000;

      const offlineContext = new OfflineAudioContext(
        1,
        Math.ceil(decodedAudio.duration * targetSampleRate),
        targetSampleRate,
      );

      const monoBuffer = offlineContext.createBuffer(
        1,
        decodedAudio.length,
        decodedAudio.sampleRate,
      );

      const monoChannel = monoBuffer.getChannelData(0);

      /*
       * 녹음에 여러 채널이 있으면 모든 채널의 평균을 내서
       * Whisper용 단일 채널로 변환합니다.
       */
      for (
        let channelIndex = 0;
        channelIndex < decodedAudio.numberOfChannels;
        channelIndex += 1
      ) {
        const channelData = decodedAudio.getChannelData(channelIndex);

        for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex += 1) {
          monoChannel[sampleIndex] +=
            channelData[sampleIndex] / decodedAudio.numberOfChannels;
        }
      }

      const source = offlineContext.createBufferSource();

      source.buffer = monoBuffer;
      source.connect(offlineContext.destination);
      source.start(0);

      const renderedAudio = await offlineContext.startRendering();

      return new Float32Array(renderedAudio.getChannelData(0));
    } finally {
      await audioContext.close();
    }
  };

  const transcribeAudio = async () => {
    const recordedBlob = recordedBlobRef.current;

    if (!recordedBlob) {
      setMessage("먼저 음성을 녹음해주세요.");
      return;
    }

    if (isTranscribing) {
      return;
    }

    setIsTranscribing(true);
    setTranscript("");

    try {
      setMessage("녹음 파일을 Whisper용 형식으로 바꾸고 있어요.");

      const audioData = await convertBlobTo16kHzAudio(recordedBlob);

      setMessage(
        isModelReady
          ? "음성을 텍스트로 변환하고 있어요."
          : "Whisper 모델을 내려받고 있어요. 처음 실행은 오래 걸릴 수 있어요.",
      );

      const transcriber = await loadWhisperModel();

      setMessage("음성을 분석하고 있어요.");

      const result = await transcriber(audioData, {
        language: "korean",
        task: "transcribe",
      });

      const recognizedText = result.text?.trim() ?? "";

      if (!recognizedText) {
        setMessage("음성을 텍스트로 변환하지 못했어요. 다시 말해주세요.");
        return;
      }

      setTranscript(recognizedText);
      setMessage("음성 변환이 완료됐어요.");

      /*
       * 음성 원본은 Supabase나 서버에 저장하지 않습니다.
       * 현재 브라우저 메모리에만 남아 있으며 초기화하면 삭제됩니다.
       */
    } catch (error) {
      console.error("음성 변환 오류:", error);

      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";

      setMessage(`음성 변환 실패: ${errorMessage}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const resetRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    stopMediaTracks();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    audioChunksRef.current = [];
    recordedBlobRef.current = null;
    mediaRecorderRef.current = null;

    setAudioUrl("");
    setTranscript("");
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingTime(0);

    setMessage("녹음 시작 버튼을 누르고 지출 내용을 말해보세요.");
  };

  return (
    <main className="container">
      <h1>무료 음성인식 테스트</h1>

      <p className="description">
        음성을 서버에 저장하지 않고 브라우저에서 직접 텍스트로
        변환합니다.
      </p>

      <button
        type="button"
        className={isRecording ? "recordButton recording" : "recordButton"}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isTranscribing}
      >
        {isRecording ? "녹음 종료" : "녹음 시작"}
      </button>

      {isRecording && (
        <p className="timer">{recordingTime}초 녹음 중</p>
      )}

      <p className="message" aria-live="polite">
        {message}
      </p>

      <section className="result">
        <strong>녹음 결과</strong>

        {audioUrl ? (
          <audio className="audioPlayer" controls src={audioUrl}>
            오디오 재생을 지원하지 않는 브라우저입니다.
          </audio>
        ) : (
          <p>아직 녹음된 파일이 없습니다.</p>
        )}
      </section>

      <button
        type="button"
        className="transcribeButton"
        onClick={transcribeAudio}
        disabled={!audioUrl || isRecording || isTranscribing}
      >
        {isTranscribing
          ? "텍스트 변환 중..."
          : "음성을 텍스트로 변환"}
      </button>

      <section className="transcriptResult">
        <strong>인식된 텍스트</strong>

        <p>
          {transcript ||
            "녹음 후 음성을 텍스트로 변환 버튼을 눌러주세요."}
        </p>
      </section>

      <button
        type="button"
        className="resetButton"
        onClick={resetRecording}
        disabled={isTranscribing}
      >
        초기화
      </button>

      <section className="guide">
        <strong>테스트 문장</strong>

        <p>“오늘 스타벅스에서 만이천 원 혼자 썼어.”</p>

        <p className="warning">
          처음 텍스트 변환을 누르면 Whisper 모델을 다운로드하므로
          상당히 오래 걸릴 수 있습니다. Wi-Fi 환경에서 먼저
          테스트해주세요.
        </p>
      </section>
    </main>
  );
}