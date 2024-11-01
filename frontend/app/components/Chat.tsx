'use client';

import { useState, useEffect, useRef } from 'react';

const formatTimeSince = (startTime: number): string => {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  if (seconds < 60) return "Just met";
  
  const minutes = Math.floor(seconds / 60);
  return `Met ${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
};

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [characterName, setCharacterName] = useState('Loading...');
  const [chatStartTime, setChatStartTime] = useState<number>(Date.now());
  const [displayTime, setDisplayTime] = useState<string>("Just met");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayTime(formatTimeSince(chatStartTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [chatStartTime]);

  useEffect(() => {
    const getInitialGreeting = async () => {
      try {
        setChatStartTime(Date.now());
        const response = await fetch('http://localhost:3001/initial-greeting');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.response) {
          setCharacterName(data.name);
          const aiMessage: Message = {
            id: Date.now().toString(),
            content: data.response,
            sender: 'ai',
          };
          setMessages([aiMessage]);
        }
      } catch (error) {
        console.error('Error getting initial greeting:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialGreeting();
  }, []);

  const handleBlock = async () => {
    setIsLoading(true);
    setMessages([]);
    setCharacterName('Loading...');
    setChatStartTime(Date.now());
    
    try {
      const response = await fetch('http://localhost:3001/initial-greeting');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.response) {
        setCharacterName(data.name);
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: data.response,
          sender: 'ai',
        };
        setMessages([aiMessage]);
      }
    } catch (error) {
      console.error('Error getting initial greeting:', error);
      setCharacterName('Error');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: 'user',
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');

    try {
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          messageHistory: [...messages, userMessage].map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          characterName: characterName
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.response) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          sender: 'ai',
        };
        setMessages(prevMessages => [...prevMessages, aiMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <div className="p-4 border-b flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">{characterName}</h1>
            <span className="text-sm text-gray-500">{displayTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          </div>
        </div>
        <button 
          onClick={handleBlock}
          className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Block
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-pulse flex space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-blue-500 text-white ml-auto'
                  : 'bg-gray-200 text-black'
              } max-w-[80%]`}
            >
              {message.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 p-2 border border-gray-300 rounded"
            placeholder="Type your message..."
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}