"use client";

import { useRef, useState } from "react";

interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
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

export default function Home() {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState("마이크 버튼을 눌러 말해보세요.");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("이 브라우저는 음성인식을 지원하지 않습니다.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setMessage("듣고 있어요. 지출 내용을 말해주세요.");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      setText(transcript);
      setMessage("음성인식이 완료됐어요.");
    };

    recognition.onerror = (event) => {
      setMessage(`음성인식 오류: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
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

      <p className="message">{message}</p>

      <section className="result">
        <strong>인식 결과</strong>
        <p>{text || "아직 인식된 내용이 없습니다."}</p>
      </section>

      <button
        type="button"
        className="resetButton"
        onClick={() => {
          setText("");
          setMessage("마이크 버튼을 눌러 말해보세요.");
        }}
      >
        초기화
      </button>
    </main>
  );
}