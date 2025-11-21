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
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-900 via-emerald-950 to-slate-950 text-emerald-50"
      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
    >
      {/* Minimal forest backdrop */}
      <div className="pointer-events-none fixed inset-0">
        {/* distant canopy */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-900/80 via-emerald-950/90 to-transparent" />
        {/* tree line */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-emerald-900 via-emerald-950/90 to-transparent" />
        {/* subtle light through trees */}
        <div className="absolute inset-x-0 top-1/3 h-40 bg-[radial-gradient(circle_at_20%_0,rgba(190,242,100,0.15),transparent_60%),radial-gradient(circle_at_80%_0,rgba(96,165,250,0.12),transparent_55%)]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-4 py-10">
        <div className="relative flex h-[700px] flex-col overflow-hidden rounded-3xl border border-emerald-500/40 bg-emerald-950/70 shadow-[0_0_45px_rgba(16,185,129,0.4)] backdrop-blur-md">
          {/* chimera aura */}
          <div className="pointer-events-none absolute left-1/2 top-4 h-44 w-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(190,242,100,0.32),transparent_65%)] blur-3xl" />

          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-emerald-800/70 px-5 py-4">
            <div className="flex items-center gap-3">
              {/* chimera icon: simple but monstrous */}
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow-[0_0_15px_rgba(190,242,100,0.7)]">
                <div className="absolute -top-1 left-1 h-3 w-3 rounded-full bg-emerald-900" />
                <div className="absolute -top-1 right-1 h-3 w-3 rounded-full bg-emerald-900" />
                <Bot className="h-5 w-5 text-emerald-950" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-wide text-emerald-50">
                  Forest Chimera Oracle
                </h1>
                <p className="text-xs text-emerald-200/80">
                  Ask your question. The chimera answers from the trees.
                </p>
              </div>
            </div>

            {/* Continuous listen + status */}
            <div className="flex flex-col items-end gap-1">
              <label
                className={`flex items-center gap-2 rounded-full border border-emerald-500/70 px-3 py-1 text-[0.65rem] tracking-wide ${
                  isSpeaking ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                } bg-emerald-950/70`}
              >
                <span className="font-mono uppercase text-emerald-200">
                  Continuous
                </span>
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
                  className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-mono uppercase tracking-[0.2em] transition ${
                    continuousListening
                      ? 'border-lime-300 bg-lime-300 text-emerald-950 shadow-[0_0_10px_rgba(190,242,100,0.7)]'
                      : 'border-emerald-500/70 bg-transparent text-emerald-200 hover:bg-emerald-800/40'
                  } ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {continuousListening ? 'On' : 'Off'}
                </button>
              </label>

              <div className="flex gap-2">
                {isListening && !isSpeaking && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/80 bg-emerald-900/80 px-2.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-[0.18em] text-emerald-100">
                    <Mic size={11} className="animate-pulse" />
                    <span>Listening</span>
                  </span>
                )}
                {isSpeaking && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-500/90 px-2.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-[0.18em] text-emerald-950 shadow-[0_0_12px_rgba(34,197,94,0.9)]">
                    <Volume2 size={11} className="animate-pulse" />
                    <span>Speaking</span>
                  </span>
                )}
                {continuousListening && !isListening && !isSpeaking && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-950/80 px-2.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-[0.18em] text-emerald-200/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    <span>Idle</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Message area: forest clearing */}
          <div className="relative flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
            {/* subtle vertical tree trunks */}
            <div className="pointer-events-none absolute inset-0 opacity-20">
              <div className="absolute inset-y-4 left-1/6 w-px bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-900" />
              <div className="absolute inset-y-6 left-1/3 w-[2px] bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-900" />
              <div className="absolute inset-y-3 right-1/4 w-[1.5px] bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-900" />
            </div>

            <div className="relative flex h-full flex-col space-y-3">
              {messages.slice(1).map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow-[0_0_12px_rgba(190,242,100,0.7)]">
                      <Bot size={16} className="text-emerald-950" />
                    </div>
                  )}

                  <div
                    className={`flex max-w-[72%] flex-col ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-md ${
                        message.role === 'user'
                          ? 'bg-emerald-900/80 text-emerald-50 border border-emerald-700/80'
                          : 'bg-emerald-50 text-emerald-950 border border-emerald-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-xs md:text-sm">
                        {message.content}
                      </p>
                    </div>

                    {message.role === 'assistant' && (
                      <button
                        onClick={() => speakText(message.content)}
                        className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-950/80 px-2.5 py-0.5 text-[0.65rem] font-mono uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-900"
                        aria-label="Text to speech"
                      >
                        <Volume2 size={11} />
                        <span>Listen</span>
                      </button>
                    )}

                    {message.timestamp && (
                      <span className="mt-1 text-[0.6rem] font-mono text-emerald-200/80">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-900/80 text-emerald-100 border border-emerald-700/80">
                      <User size={16} />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center justify-start gap-2">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow-[0_0_12px_rgba(190,242,100,0.7)]">
                    <Bot size={16} className="text-emerald-950" />
                  </div>
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/90 px-3 py-2">
                    <div className="flex gap-1.5">
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input at forest floor */}
          <div className="border-t border-emerald-800/70 bg-emerald-950/80 px-4 py-3">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening ? 'The forest is listening... speak now.' : 'Ask the chimera...'
                }
                className={`flex-1 rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/70 ${
                  isListening
                    ? 'border-emerald-500 bg-emerald-950 text-emerald-50 placeholder-emerald-300 font-mono'
                    : 'border-emerald-700/70 bg-emerald-900/60 text-emerald-50 placeholder-emerald-300/70'
                }`}
                style={{ fontFamily: isListening ? 'monospace' : 'inherit' }}
                disabled={isLoading}
                readOnly={isListening}
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-emerald-50 transition ${
                  isRecording
                    ? 'border-lime-300 bg-lime-400 text-emerald-950 animate-pulse'
                    : 'border-emerald-600 bg-emerald-900/80 hover:bg-emerald-800'
                }`}
                disabled={isLoading || continuousListening}
                title={continuousListening ? 'Mic is auto-managed in continuous mode' : 'Push to talk'}
              >
                {isRecording ? <Square size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="submit"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500 bg-emerald-400 text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!input.trim() || isLoading}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
