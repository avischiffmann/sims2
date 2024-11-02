'use client';

import { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

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
  const [isAutoDeveloping, setIsAutoDeveloping] = useState(true);
  const [lastUserMessageTime, setLastUserMessageTime] = useState<number>(Date.now());
  const [lullTimeout, setLullTimeout] = useState<NodeJS.Timeout | null>(null);
  const [proactiveSent, setProactiveSent] = useState(false);
  const [proactiveCount, setProactiveCount] = useState(0);
  const [chattedCharacters, setChattedCharacters] = useState<{ [key: string]: number }>({});
  const [isAiTyping, setIsAiTyping] = useState(false);

  useEffect(() => {
    const storedData = localStorage.getItem('chattedCharacters');
    if (storedData) {
      const charactersData = JSON.parse(storedData);
      setChattedCharacters(charactersData);
      console.log('Chatted Characters:', charactersData);
    }
  }, []);

  const updateChattedCharacters = (name: string, seconds: number) => {
    if (name === "Loading...") return;

    setChattedCharacters(prev => {
      const updatedList = { ...prev, [name]: (prev[name] || 0) + seconds };
      localStorage.setItem('chattedCharacters', JSON.stringify(updatedList));
      return updatedList;
    });
  };

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
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/initial-greeting`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.response) {
          setCharacterName(data.name);
          updateChattedCharacters(data.name, 0);
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

  useEffect(() => {
    if (lullTimeout) {
      clearTimeout(lullTimeout);
    }

    const timeout = setTimeout(() => {
      if (messages.length > 0 && proactiveCount < 2) {
        handleDevelopment();
        setProactiveCount(prevCount => prevCount + 1);
      }
    }, proactiveCount === 0 ? 10000 : 35000);

    setLullTimeout(timeout);

    return () => clearTimeout(timeout);
  }, [lastUserMessageTime, messages, proactiveCount]);

  const handleBlock = async () => {
    setIsLoading(true);
    setMessages([]);
    setCharacterName('Loading...');
    setChatStartTime(Date.now());
    setProactiveSent(false);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/initial-greeting`);
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
    setLastUserMessageTime(Date.now());
    setProactiveCount(0);
    setIsAiTyping(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/chat`, {
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
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleDevelopment = async () => {
    setIsAiTyping(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/story-development`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageHistory: messages.map(msg => ({
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
          id: Date.now().toString(),
          content: data.response,
          sender: 'ai',
        };
        setMessages(prevMessages => [...prevMessages, aiMessage]);
      }
    } catch (error) {
      console.error('Error getting story development:', error);
    } finally {
      setIsAiTyping(false);
    }
  };

  useEffect(() => {
    if (characterName === "Loading...") return;

    const interval = setInterval(() => {
      updateChattedCharacters(characterName, 1); // Increment by 1 second
    }, 1000); // 1000 ms = 1 second

    return () => clearInterval(interval);
  }, [characterName]);

  return (
    <div className="flex h-screen">
      <div className="w-64 border-r bg-white p-4 flex flex-col h-full">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Chat History</h2>
            <button 
              onClick={() => {
                localStorage.clear();
                setChattedCharacters({});
              }}
              className="px-2 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              Clear History
            </button>
          </div>
          {Object.entries(chattedCharacters).map(([name, seconds]) => (
            <div key={name} className="mb-2 p-2 border-b">
              <div className="font-medium">{name}</div>
              <div className="text-sm text-gray-500">
                {Math.floor(seconds / 60)} minutes {seconds % 60} seconds
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-sm text-gray-400 mt-auto pt-4 font-miller">
          friend.com
        </div>
      </div>

      <div className="flex flex-col h-screen max-w-2xl mx-auto flex-grow">
        <div className="p-4 border-b flex items-center justify-between bg-white">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold font-georgia">{characterName}</h1>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            </div>
            <span className="text-sm text-gray-500">{displayTime}</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleBlock}
              className="px-4 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              Block
            </button>
          </div>
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
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`p-4 rounded-2xl max-w-[80%] ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-black rounded-bl-sm'
                    } shadow-sm`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isAiTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-4 rounded-2xl rounded-bl-sm max-w-[80%] shadow-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 p-2 pl-4 border border-gray-300 rounded-full"
              placeholder="Type your message..."
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className={`p-2 rounded-full ${
                input.trim() 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}