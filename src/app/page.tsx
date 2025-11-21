'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Volume2, User, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  id: string;
  isFloating?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content:
        'You are a poet pregnant with your third child who enters the performance space wrapped in a white sheet and carrying a bucket of mud in the wake of your experiments with lysergic acid dietylamide and immersions in the Upanishads, the Bhagavad Gita, and the Yoga Sutra while slowly extracting a scroll from your vagina, asshole, ear, or nose and then reading a text made up of idiom and lyricism that is material and extreme in response to criticism accusing you of making messy, bloody, scatalogical work that cancels the boundaries between prose and poetry searching for patterns woven out of small actions confirming the notion that seeing what is is a radical human gesture while dressed in foul-smelling clothes.',
      id: 'system-prompt',
    },
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const continuousListeningRef = useRef(continuousListening);
  const messagesRef = useRef(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep refs in sync with state
  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handle auto-submit from speech recognition with fresh state
  const handleAutoSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    console.log('handleAutoSubmit called with:', text);
    console.log('Current continuous listening:', continuousListeningRef.current);

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messagesRef.current, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // ALWAYS auto-speak when called from speech recognition
      console.log('Auto-speaking response:', assistantMessage.content);
      await speakText(assistantMessage.content);
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);

      await speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Speech Recognition once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          console.log('Speech result received:', event.results);
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Result ${i}: ${transcript}, isFinal: ${event.results[i].isFinal}`);
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Show live transcription in input box
          if (interimTranscript) {
            console.log('Setting interim transcript:', interimTranscript);
            setInput(interimTranscript);
          }

          // When we get a final result (after silence), auto-submit
          if (finalTranscript) {
            const fullText = finalTranscript.trim();
            console.log('Final transcript received:', fullText);
            console.log('Continuous listening ref:', continuousListeningRef.current);
            if (fullText && continuousListeningRef.current) {
              setInput(fullText);
              // Stop listening while we process
              recognition.stop();
              // Auto-submit after a brief delay
              setTimeout(() => {
                console.log('Auto-submitting message:', fullText);
                handleAutoSubmit(fullText);
              }, 500);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        console.log('Speech recognition initialized');
      } else {
        console.error('Speech Recognition not supported in this browser');
        alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition on cleanup');
        }
      }
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('Starting speech recognition...');
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition already started or error:', e);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        console.log('Stopping speech recognition...');
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
  };

  // Handle continuous listening restart after speech ends or AI finishes speaking
  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      console.log('Restarting speech recognition for continuous mode');
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [continuousListening, isSpeaking, isListening, isLoading]);

  const startRecording = async () => {
    try {
      // If we already have a stream in continuous mode, just start a new recording
      if (continuousListening && streamRef.current) {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);

          // In continuous mode, restart recording after transcription (unless speaking)
          if (continuousListening && !isSpeaking) {
            setTimeout(() => startRecording(), 100);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        return;
      }

      // Initial setup - get the stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);

        // In continuous mode, restart recording after transcription (unless speaking)
        if (continuousListening && !isSpeaking) {
          setTimeout(() => startRecording(), 100);
        } else if (!continuousListening) {
          // Clean up stream if not in continuous mode
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('file', file);

      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      setInput(data.text);
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      alert(error.message || 'Failed to transcribe audio');
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      console.log('Sending text to speech API:', text);

      // Stop speech recognition while AI is speaking
      if (isListening) {
        stopSpeechRecognition();
      }
      // Also stop recording if using mic button
      if (isRecording) {
        stopRecording();
      }
      setIsSpeaking(true);

      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response from speech API:', response.status, errorData);
        throw new Error(errorData.error || `Failed to generate speech: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');
      console.log('Response content type:', contentType);

      if (!contentType || !contentType.includes('audio/mpeg')) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Invalid response format:', errorData);
        throw new Error(errorData.error || 'Response was not audio format');
      }

      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        console.error('Empty audio blob received');
        throw new Error('Empty audio received from API');
      }

      console.log('Audio blob received, size:', audioBlob.size);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onerror = (e) => {
        console.error('Error playing audio:', e);
        setIsSpeaking(false);
        // Resume speech recognition if in continuous mode
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio error');
          setTimeout(() => startSpeechRecognition(), 100);
        }
      };

      audio.onended = () => {
        console.log('Audio playback ended');
        setIsSpeaking(false);
        // Resume speech recognition after AI finishes speaking
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio ended');
          setTimeout(() => startSpeechRecognition(), 500);
        }
      };

      console.log('Starting audio playback...');
      await audio.play();
      console.log('Audio playback started');
    } catch (error: any) {
      console.error('Error generating speech:', error);
      setIsSpeaking(false);
      // Resume speech recognition if in continuous mode even on error
      if (continuousListeningRef.current) {
        setTimeout(() => startSpeechRecognition(), 100);
      }
      alert(error.message || 'Failed to generate speech');
    }
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // Auto-speak the response in continuous listening mode
      console.log('Continuous listening:', continuousListening, 'Content:', assistantMessage.content);
      if (continuousListening) {
        console.log('Auto-speaking the response...');
        await speakText(assistantMessage.content);
      }
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);

      // Also speak error message in continuous mode
      if (continuousListening) {
        await speakText(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-emerald-950 to-amber-900 text-emerald-50"
      style={{ fontFamily: '"Cinzel", "Times New Roman", serif' }}
    >
      {/* atmospheric background */}
      <div className="pointer-events-none fixed inset-0">
        {/* sky stars */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(148,163,184,0.35),transparent_60%),radial-gradient(circle_at_80%_10%,rgba(248,250,252,0.28),transparent_55%)] opacity-40" />
        {/* forest silhouette */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-emerald-900 via-emerald-950/95 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 py-10">
        <div className="relative h-[720px] flex flex-col overflow-hidden rounded-3xl border border-emerald-500/60 bg-gradient-to-b from-slate-950/95 via-emerald-950/95 to-slate-950/95 shadow-[0_0_60px_rgba(16,185,129,0.55)]">
          {/* oracle glow */}
          <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(94,234,212,0.4),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-60px] left-1/2 h-80 w-[460px] -translate-x-1/2 rounded-[999px] bg-[radial-gradient(circle_at_50%_20%,rgba(45,212,191,0.7),transparent_60%),radial-gradient(circle_at_50%_100%,rgba(253,224,171,0.85),transparent_60%)] blur-3xl opacity-80" />

          {/* SKY: title + question input */}
          <div className="relative border-b border-emerald-500/50 bg-gradient-to-b from-slate-950/95 via-sky-950/30 to-transparent px-6 pt-5 pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-[0.18em] uppercase text-emerald-100">
                    Oracle of the Chimera Spring
                  </h1>
                  <p className="mt-1 text-xs md:text-sm text-emerald-200/80">
                    Write your question into the night sky. The chimera-headed oracle replies in steam and forest light.
                  </p>
                </div>

                {/* listening controls */}
                <div className="flex flex-col items-end gap-2 text-[0.6rem] md:text-[0.65rem] font-mono">
                  <label
                    className={`flex items-center gap-2 rounded-full border border-emerald-400/70 px-3 py-1.5 shadow-sm ${
                      isSpeaking ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-teal-300'
                    } bg-slate-950/80`}
                  >
                    <span className="tracking-[0.18em] uppercase text-emerald-200">Continuous Listen</span>
                    <button
                      onClick={async () => {
                        if (isSpeaking) return;
                        const newValue = !continuousListening;
                        if (newValue) {
                          try {
                            await navigator.mediaDevices.getUserMedia({ audio: true });
                            console.log('Microphone permission granted');
                            setContinuousListening(true);
                            startSpeechRecognition();
                          } catch (error) {
                            console.error('Microphone permission denied:', error);
                            alert('Please allow microphone access to use speech recognition');
                          }
                        } else {
                          setContinuousListening(false);
                          stopSpeechRecognition();
                          setInput('');
                        }
                      }}
                      disabled={isSpeaking}
                      className={`rounded-full border border-emerald-400/80 px-3 py-1 text-[0.6rem] tracking-[0.2em] uppercase transition ${
                        continuousListening
                          ? 'bg-emerald-400 text-slate-950 shadow-[0_0_14px_rgba(74,222,128,0.95)]'
                          : 'bg-slate-950/80 text-emerald-100 hover:bg-emerald-500/20'
                      } ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {continuousListening ? 'On' : 'Off'}
                    </button>
                  </label>

                  <div className="flex gap-2">
                    {isListening && !isSpeaking && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/80 bg-sky-900/70 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.85)]">
                        <Mic size={11} className="animate-pulse" />
                        <span>Listening</span>
                      </span>
                    )}
                    {isSpeaking && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-500/90 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-slate-950 shadow-[0_0_16px_rgba(22,163,74,0.98)]">
                        <Volume2 size={11} className="animate-pulse" />
                        <span>Speaking</span>
                      </span>
                    )}
                    {continuousListening && !isListening && !isSpeaking && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/70 bg-slate-950/80 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-emerald-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                        <span>Awaiting Echo</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* QUESTION INPUT IN THE SKY */}
              <form
                onSubmit={handleSubmit}
                className="mt-1 flex items-center gap-2 rounded-2xl border border-sky-400/70 bg-slate-950/80 px-3 py-2 shadow-[0_0_28px_rgba(56,189,248,0.7)] backdrop-blur-md"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isListening
                      ? '⋆ The sky is listening. Speak your question...'
                      : 'Etch your question into the clouded stars...'
                  }
                  className={`flex-1 border-0 bg-transparent text-xs md:text-sm text-emerald-50 placeholder-emerald-200/60 focus:outline-none focus:ring-0 ${
                    isListening ? 'font-mono tracking-[0.12em] uppercase' : ''
                  }`}
                  style={{ fontFamily: isListening ? 'monospace' : '"Cinzel", "Times New Roman", serif' }}
                  disabled={isLoading}
                  readOnly={isListening}
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/80 text-emerald-100 transition ${
                    isRecording
                      ? 'bg-emerald-500/90 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.95)] animate-pulse'
                      : 'bg-slate-950/80 hover:bg-emerald-500/20'
                  }`}
                  disabled={isLoading || continuousListening}
                  title={continuousListening ? 'Mic is auto-managed in continuous mode' : 'Speak into the steam'}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                </button>
                <button
                  type="submit"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/80 bg-sky-500/90 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.95)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send question to oracle"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>

          {/* FOREST & HOT SPRING: message stream */}
          <div className="relative flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            {/* forest canopy glow */}
            <div className="pointer-events-none absolute inset-x-0 top-4 h-24 bg-[radial-gradient(circle_at_20%_0,rgba(34,197,94,0.4),transparent_60%),radial-gradient(circle_at_80%_10%,rgba(22,163,74,0.55),transparent_60%)] opacity-50" />
            {/* oracle “head” just above spring */}
            <div className="pointer-events-none absolute left-1/2 bottom-20 h-16 w-28 -translate-x-1/2 rounded-[42px] bg-gradient-to-r from-emerald-900 via-slate-950 to-emerald-900 shadow-[0_0_26px_rgba(15,23,42,0.95)]">
              <div className="absolute -top-2 left-1/2 flex -translate-x-1/2 gap-1">
                <span className="h-4 w-4 rounded-full bg-emerald-400/90 shadow-[0_0_10px_rgba(74,222,128,0.95)]" />
                <span className="h-4 w-4 rounded-full bg-sky-300/90 shadow-[0_0_10px_rgba(56,189,248,0.95)]" />
                <span className="h-4 w-4 rounded-full bg-amber-300/90 shadow-[0_0_10px_rgba(252,211,77,0.95)]" />
              </div>
              <div className="absolute inset-x-4 bottom-1 flex justify-between text-[0.55rem] uppercase tracking-[0.18em] text-emerald-100/70">
                <span>Oracle</span>
                <span>Chimera</span>
              </div>
            </div>
            {/* hot spring pool */}
            <div className="pointer-events-none absolute inset-x-6 bottom-6 h-40 rounded-[100%] bg-[radial-gradient(circle_at_50%_20%,rgba(45,212,191,0.8),transparent_60%),radial-gradient(circle_at_50%_100%,rgba(253,224,171,0.9),transparent_65%)] opacity-80 blur-sm" />

            <div className="relative space-y-4">
              {messages.slice(1).map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-700/70 shadow-[0_0_18px_rgba(45,212,191,0.85)]">
                      <Bot size={18} className="text-emerald-50" />
                    </div>
                  )}

                  <div
                    className={`flex max-w-[72%] flex-col ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`rounded-2xl border px-3 py-2.5 text-sm leading-relaxed shadow-md backdrop-blur-sm ${
                        message.role === 'user'
                          ? 'border-sky-300/70 bg-sky-100/90 text-slate-900 shadow-[0_0_18px_rgba(56,189,248,0.65)]'
                          : 'border-emerald-200/70 bg-gradient-to-b from-emerald-800/85 via-emerald-950/95 to-slate-950 text-emerald-50 shadow-[0_0_22px_rgba(16,185,129,0.8)]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-xs md:text-sm">
                        {message.content}
                      </p>
                    </div>

                    {message.role === 'assistant' && (
                      <button
                        onClick={() => speakText(message.content)}
                        className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-slate-950/80 px-2.5 py-1 text-[0.66rem] font-mono uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-500/20"
                        aria-label="Text to speech"
                      >
                        <Volume2 size={11} />
                        <span>Hear the spring</span>
                      </button>
                    )}

                    {message.timestamp && (
                      <span className="mt-1 text-[0.6rem] font-mono uppercase tracking-[0.15em] text-emerald-200/70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-sky-300/70 bg-slate-950/80 shadow-[0_0_14px_rgba(56,189,248,0.65)]">
                      <User size={18} className="text-sky-200" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center justify-start gap-2">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-700/70 shadow-[0_0_18px_rgba(45,212,191,0.85)]">
                    <Bot size={18} className="text-emerald-50" />
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-900/90 px-3 py-2.5 shadow-[0_0_18px_rgba(16,185,129,0.75)]">
                    <div className="flex gap-2">
                      <div
                        className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* footer grounding strip */}
          <div className="relative h-9 border-t border-emerald-500/50 bg-gradient-to-t from-amber-900/80 via-emerald-950/90 to-transparent px-6">
            <div className="flex h-full items-center justify-between text-[0.6rem] uppercase tracking-[0.18em] text-emerald-200/70">
              <span>Forest Channel Open</span>
              <span>Serpent-Oracular Interface v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
