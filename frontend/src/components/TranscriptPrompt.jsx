import React, { useState } from 'react';

const TranscriptPrompt = ({ onSubmit }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    try {
      await onSubmit(prompt);
      setPrompt(''); // Clear input after successful submission
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask a question about the video..."
        className="flex-1 p-1 text-sm border rounded"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !prompt.trim()}
        className={`px-3 py-1 text-sm text-white rounded ${
          isLoading || !prompt.trim() 
            ? 'bg-gray-400' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isLoading ? 'Sending...' : 'Ask'}
      </button>
    </form>
  );
};

export default TranscriptPrompt;