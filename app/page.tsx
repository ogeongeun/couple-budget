"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState(
    "녹음 시작 버튼을 누르고 말해보세요.",
  );
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const startRecording = async () => {
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);
        setMessage("녹음 중이에요. 말을 끝낸 뒤 녹음 종료를 눌러주세요.");

        timerRef.current = setInterval(() => {
          setRecordingTime((previous) => previous + 1);
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

        console.log("녹음 결과:", {
          size: audioBlob.size,
          type: audioBlob.type,
        });

        if (audioBlob.size === 0) {
          setMessage("녹음 파일이 비어 있어요. 다시 시도해주세요.");
          setIsRecording(false);
          stopMediaTracks();
          return;
        }

        const newAudioUrl = URL.createObjectURL(audioBlob);

        setAudioUrl(newAudioUrl);
        setIsRecording(false);
        setMessage(
          `녹음이 완료됐어요. 파일 크기: ${Math.ceil(
            audioBlob.size / 1024,
          )}KB`,
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
          setMessage("마이크 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.");
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
    mediaRecorderRef.current = null;

    setAudioUrl("");
    setIsRecording(false);
    setRecordingTime(0);
    setMessage("녹음 시작 버튼을 누르고 말해보세요.");
  };

  return (
    <main className="container">
      <h1>음성 녹음 테스트</h1>

      <p className="description">
        먼저 아이폰과 컴퓨터에서 녹음과 재생이 되는지 확인합니다.
      </p>

      <button
        type="button"
        className={isRecording ? "recordButton recording" : "recordButton"}
        onClick={isRecording ? stopRecording : startRecording}
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
          <>
            <audio className="audioPlayer" controls src={audioUrl}>
              오디오 재생을 지원하지 않는 브라우저입니다.
            </audio>

            <p className="successMessage">
              재생 버튼을 눌러 목소리가 들리는지 확인해주세요.
            </p>
          </>
        ) : (
          <p>아직 녹음된 파일이 없습니다.</p>
        )}
      </section>

      <button
        type="button"
        className="resetButton"
        onClick={resetRecording}
      >
        초기화
      </button>

      <section className="guide">
        <strong>테스트 방법</strong>
        <p>
          녹음 시작을 누르고 5초 정도 말한 다음 녹음 종료를 누르세요.
          이후 재생 버튼을 눌러 목소리가 들리면 성공입니다.
        </p>
      </section>
    </main>
  );
}