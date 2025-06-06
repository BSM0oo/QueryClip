import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Edit, Trash, RefreshCw, Check, X } from 'lucide-react';
import { queryTranscript } from '../utils/apiUtils';

const PromptResponseCard = ({ screenshot, editMode, index, onUpdatePromptResponse }) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [localEditMode, setLocalEditMode] = useState(false);
  const [tempPrompt, setTempPrompt] = useState(screenshot.prompt || '');
  const [tempResponse, setTempResponse] = useState(screenshot.response || '');
  
  const handleUpdate = (field, value) => {
    onUpdatePromptResponse(index, {
      ...screenshot,
      [field]: value
    });
  };
  
  const handleEdit = () => {
    setTempPrompt(screenshot.prompt);
    setTempResponse(screenshot.response);
    setLocalEditMode(true);
  };
  
  const handleSave = () => {
    onUpdatePromptResponse(index, {
      ...screenshot,
      prompt: tempPrompt,
      response: tempResponse
    });
    setLocalEditMode(false);
  };
  
  const handleCancel = () => {
    setTempPrompt(screenshot.prompt);
    setTempResponse(screenshot.response);
    setLocalEditMode(false);
  };
  
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this query response?')) {
      onUpdatePromptResponse(index, null);
    }
  };
  
  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      // Assuming there's a transcript passed from parent component - we're using screenshot.transcriptContext
      const result = await queryTranscript(
        screenshot.transcriptContext || '', 
        screenshot.prompt
      );
      
      if (result && result.response) {
        onUpdatePromptResponse(index, {
          ...screenshot,
          response: result.response
        });
      }
    } catch (error) {
      console.error('Error regenerating response:', error);
      alert('Failed to regenerate response. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Show edit controls if in global edit mode or local edit mode
  const showEditForm = editMode || localEditMode;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 space-y-4">
        {showEditForm ? (
          <>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Query:</label>
              <textarea
                value={localEditMode ? tempPrompt : screenshot.prompt}
                onChange={(e) => localEditMode ? setTempPrompt(e.target.value) : handleUpdate('prompt', e.target.value)}
                className="w-full min-h-[80px] p-3 border rounded-md resize-y text-sm font-sans"
                placeholder="Enter your query..."
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Response:</label>
              <textarea
                value={localEditMode ? tempResponse : screenshot.response}
                onChange={(e) => localEditMode ? setTempResponse(e.target.value) : handleUpdate('response', e.target.value)}
                className="w-full min-h-[200px] p-3 border rounded-md resize-y text-sm font-sans"
                placeholder="Enter the response..."
              />
            </div>
            
            {/* Show save/cancel buttons when in local edit mode */}
            {localEditMode && (
              <div className="flex justify-end space-x-2 mt-4">
                <button 
                  onClick={handleCancel}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-blue-800 font-medium">Query:</p>
              <p className="text-blue-900">{screenshot.prompt}</p>
            </div>
            <div className="prose prose-sm max-w-none">
              <div className="markdown-content">
                <ReactMarkdown
                  components={{
                    ul: ({node, ...props}) => (
                      <ul className="list-disc pl-4 space-y-1 mb-4" {...props} />
                    ),
                    li: ({node, ...props}) => (
                      <li className="ml-4" {...props} />
                    ),
                    h2: ({node, ...props}) => (
                      <h2 className="text-lg font-bold mt-4 mb-2" {...props} />
                    ),
                    p: ({node, ...props}) => (
                      <p className="mb-4" {...props} />
                    ),
                    strong: ({node, ...props}) => (
                      <strong className="font-bold" {...props} />
                    )
                  }}
                >
                  {screenshot.response}
                </ReactMarkdown>
              </div>
            </div>
            
            {/* Action buttons for view mode */}
            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 mt-4">
              <button 
                onClick={handleEdit}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </button>
              <button 
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md ${
                  isRegenerating 
                    ? 'text-gray-500 bg-gray-100 cursor-not-allowed' 
                    : 'text-white bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button 
                onClick={handleDelete}
                className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <Trash className="h-4 w-4 mr-1" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PromptResponseCard;