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
  const chunksRef =

