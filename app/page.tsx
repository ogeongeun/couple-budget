"use client";

import { useRef, useState } from "react";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;

  start: () => void;
  stop: () => void;
  abort: () => void;

  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const errorMessages: Record<string, string> = {
  "not-allowed": "마이크 또는 음성인식 권한이 거부됐어요.",
  "service-not-allowed": "아이폰에서 음성인식 서비스를 사용할 수 없어요.",
  "audio-capture": "마이크 입력을 사용할 수 없어요.",
  "no-speech": "음성이 감지되지 않았어요. 조금 더 크게 말해주세요.",
  network: "음성인식 서버 연결에 실패했어요.",
  aborted: "음성인식이 중단됐어요.",
  "language-not-supported": "한국어 음성인식을 지원하지 않는 환경이에요.",
};

export default function Home() {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState(
    "마이크 버튼을 누르고 지출 내용을 말해보세요.",
  );

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const startListening = () => {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "이 브라우저는 음성인식을 지원하지 않아요. 아이폰 Safari에서 열어주세요.",
      );
      return;
    }

    // 이전 음성인식이 남아 있다면 종료
    recognitionRef.current?.abort();

    const recognition = new SpeechRecognition();
    let receivedResult = false;
    let receivedError = false;

    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setText("");
      setMessage("듣고 있어요. 지금 말해주세요.");
    };

    recognition.onresult = (event) => {
      const firstResult = event.results[0];
      const firstAlternative = firstResult?.[0];
      const transcript = firstAlternative?.transcript?.trim();

      if (!transcript) {
        return;
      }

      receivedResult = true;
      setText(transcript);
      setMessage("음성인식이 완료됐어요.");
    };

    recognition.onerror = (event) => {
      receivedError = true;

      console.error("음성인식 오류:", {
        error: event.error,
        message: event.message,
      });

      setMessage(
        errorMessages[event.error] ?? `음성인식 오류: ${event.error}`,
      );

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (!receivedResult && !receivedError) {
        setMessage(
          "인식 결과가 없어요. Safari에서 다시 누르고 조금 더 크게 말해주세요.",
        );
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("음성인식 시작 실패:", error);
      setIsListening(false);
      setMessage("음성인식을 시작하지 못했어요. 잠시 후 다시 눌러주세요.");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setMessage("음성인식을 종료하고 있어요.");
  };

  const resetResult = () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    setText("");
    setIsListening(false);
    setMessage("마이크 버튼을 누르고 지출 내용을 말해보세요.");
  };

  return (
    <main className="container">
      <h1>음성 지출 기록 테스트</h1>

      <p className="description">
        예: 오늘 스타벅스에서 만이천 원 썼어
      </p>

      <button
        type="button"
        className={isListening ? "micButton listening" : "micButton"}
        onClick={isListening ? stopListening : startListening}
      >
        {isListening ? "인식 중지" : "말하기 시작"}
      </button>

      <p className="message" aria-live="polite">
        {message}
      </p>

      <section className="result">
        <strong>인식 결과</strong>
        <p>{text || "아직 인식된 내용이 없습니다."}</p>
      </section>

      <button type="button" className="resetButton" onClick={resetResult}>
        초기화
      </button>

      <section className="guide">
        <strong>아이폰 테스트 방법</strong>
        <p>
          홈 화면 아이콘이 아니라 Safari에서 Vercel 주소를 직접 열고
          테스트해주세요.
        </p>
      </section>
    </main>
  );
}