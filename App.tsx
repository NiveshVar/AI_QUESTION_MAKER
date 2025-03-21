import React, { useState } from 'react';
import { BookOpen, Brain, FileQuestion, Settings, AlertCircle, Download } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun } from 'docx';

interface Question {
  type: 'mcq' | 'short' | 'long' | 'coding';
  difficulty: 'easy' | 'moderate' | 'hard';
  question: string;
  options?: string[];
  answer?: string;
  code?: string; // For coding questions
}

function App() {
  const [text, setText] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState({
    mcq: true,
    short: true,
    long: false,
    coding: true, // New question type: Coding
    questionsPerType: 3,
    difficultyLevels: {
      easy: true,
      moderate: true,
      hard: true,
    },
  });

  // Function to call Google AI Studio API for question generation
  const generateQuestionsWithGoogleAI = async (text: string) => {
    const apiKey = "AIzaSyDZO_vUYksKm91-FkEu_cIFNiAc1_5wtbQ"; // Replace with your Google AI Studio API key
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    if (!apiKey) {
      throw new Error('Google AI API key is missing. Please check your environment variables.');
    }

    // Construct the prompt based on user settings
    const questionTypes = [];
    if (settings.mcq) questionTypes.push(`${settings.questionsPerType} multiple-choice questions (MCQ) with 4 options each`);
    if (settings.short) questionTypes.push(`${settings.questionsPerType} short-answer questions`);
    if (settings.long) questionTypes.push(`${settings.questionsPerType} long-answer questions`);
    if (settings.coding) questionTypes.push(`${settings.questionsPerType} coding questions`); // Add coding questions

    const difficultyLevels = Object.entries(settings.difficultyLevels)
      .filter(([_, checked]) => checked)
      .map(([level]) => level)
      .join(', ');

    const prompt = `Generate the following questions based on the text below:
    - ${questionTypes.join('\n- ')}
    
    The questions must align with the following difficulty levels: ${difficultyLevels}.
    
    Difficulty Levels:
    1. *Easy* – Simple questions that test basic knowledge (e.g., recall facts, define terms).
    2. *Moderate* – Questions that require understanding and application of concepts (e.g., explain processes, solve problems).
    3. *Hard* – Challenging questions that require analysis, evaluation, or creativity (e.g., compare and contrast, design experiments).
    
    For multiple-choice questions (MCQ), provide the question followed by 4 options separated by "|". The first option should be the correct answer.
    Example: MCQ: What is photosynthesis? | Process by which plants convert sunlight into energy | Process of breathing | Process of digestion | Process of reproduction
    
    For short-answer questions, start the question with "Q:".
    For long-answer questions, start the question with "LQ:".
    For coding questions, start the question with "CQ:" and provide a code snippet or problem statement.
    Example: CQ: Write a Python function to calculate the factorial of a number. | def factorial(n): return 1 if n == 0 else n * factorial(n-1)
    
    Ensure the questions are relevant to the text and match the specified difficulty levels.
    
    Text: ${text}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const generatedQuestions = parseAIResponse(data.candidates[0].content.parts[0].text);
        setQuestions(generatedQuestions);
      } else {
        throw new Error('No questions generated by AI.');
      }
    } catch (error) {
      console.error('Error generating questions with Google AI:', error);
      throw error; // Re-throw the error for handling in the calling function
    }
  };

  // Function to parse AI response into structured questions
  const parseAIResponse = (response: string): Question[] => {
    const questions: Question[] = [];
    const lines = response.split('\n').filter((line) => line.trim());

    lines.forEach((line) => {
      if (line.startsWith('Q:')) {
        questions.push({
          type: 'short',
          difficulty: 'moderate', // Default difficulty, can be adjusted based on AI response
          question: line.replace('Q:', '').trim(),
        });
      } else if (line.startsWith('MCQ:')) {
        const parts = line.replace('MCQ:', '').split('|');
        if (parts.length >= 5) {
          // Ensure there are 4 options and 1 question
          questions.push({
            type: 'mcq',
            difficulty: 'easy', // Default difficulty, can be adjusted based on AI response
            question: parts[0].trim(),
            options: parts.slice(1, 5).map((opt) => opt.trim()), // Extract 4 options
            answer: parts[1].trim(), // First option is the correct answer
          });
        }
      } else if (line.startsWith('LQ:')) {
        questions.push({
          type: 'long',
          difficulty: 'hard', // Default difficulty, can be adjusted based on AI response
          question: line.replace('LQ:', '').trim(),
        });
      } else if (line.startsWith('CQ:')) {
        const parts = line.replace('CQ:', '').split('|');
        if (parts.length >= 2) {
          // Ensure there is a question and a code snippet
          questions.push({
            type: 'coding',
            difficulty: 'moderate', // Default difficulty, can be adjusted based on AI response
            question: parts[0].trim(),
            code: parts[1].trim(), // Code snippet
          });
        }
      }
    });

    return questions;
  };

  // Function to generate and download questions as a Word document
  const downloadQuestionsAsDoc = () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: questions.map((question, index) => (
            new Paragraph({
              children: [
                new TextRun({
                  text: `Question ${index + 1}: ${question.question}`,
                  bold: true,
                }),
                ...(question.type === 'mcq' && question.options
                  ? question.options.map((option, optIndex) => (
                      new TextRun({
                        text: `\nOption ${optIndex + 1}: ${option}`,
                        break: 1,
                      })
                    ))
                  : []),
                ...(question.type === 'coding' && question.code
                  ? [
                      new TextRun({
                        text: `\nCode:\n${question.code}`,
                        break: 1,
                      }),
                    ]
                  : []),
                new TextRun({
                  text: `\nAnswer: ${question.answer || question.code || 'Refer to the first option for MCQ'}`,
                  bold: true,
                  break: 2,
                }),
              ],
            })
          )),
        },
      ],
    });

    Packer.toBlob(doc).then((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'GeneratedQuestions.docx';
      link.click();
      URL.revokeObjectURL(link.href);
    });
  };

  const generateQuestions = async () => {
    if (!text.trim()) {
      alert('Please enter some text first');
      return;
    }

    setGenerating(true);
    try {
      await generateQuestionsWithGoogleAI(text);
    } catch (error) {
      console.error('Error generating questions:', error);
      alert(`Error generating questions: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-2xl font-bold text-gray-900">AIQGen</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Text Input Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <h2 className="text-lg font-semibold">Enter Topic</h2>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-40 p-2 border border-gray-300 rounded-lg"
              placeholder="Paste your text here..."
            />
          </div>

          {/* Settings Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Settings className="h-5 w-5 text-indigo-600" />
              <h2 className="ml-2 text-lg font-semibold">Customize Generation</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Question Types</label>
                <div className="mt-2 space-y-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.mcq}
                      onChange={(e) => setSettings({ ...settings, mcq: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2">Multiple Choice</span>
                  </label>
                  <br />
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.short}
                      onChange={(e) => setSettings({ ...settings, short: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2">Short Answer</span>
                  </label>
                  <br />
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.coding}
                      onChange={(e) => setSettings({ ...settings, coding: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2">Coding</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Questions per type
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.questionsPerType}
                  onChange={(e) => setSettings({ ...settings, questionsPerType: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Difficulty Levels Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <h2 className="ml-2 text-lg font-semibold">Difficulty Levels</h2>
            </div>
            <div className="space-y-2">
              {Object.entries(settings.difficultyLevels).map(([level, checked]) => (
                <label key={level} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        difficultyLevels: {
                          ...settings.difficultyLevels,
                          [level]: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 capitalize">{level}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={generateQuestions}
            disabled={!text || generating}
            className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white ${
              !text || generating ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <FileQuestion className="h-5 w-5 mr-2" />
            {generating ? 'Generating Questions...' : 'Generate Questions'}
          </button>
          {questions.length > 0 && (
            <button
              onClick={downloadQuestionsAsDoc}
              className="inline-flex items-center px-6 py-3 ml-4 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <Download className="h-5 w-5 mr-2" />
              Download as Word
            </button>
          )}
        </div>

        {/* Generated Questions Section */}
        {questions.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Generated Questions</h2>
            <h3>Note: For MCQ's First option is the correct answer</h3>
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={index} className="border-l-4 border-indigo-500 pl-4 py-2">
                  <div className="flex items-center mb-2">
                    <span className="text-sm font-medium text-gray-500 uppercase">{question.type}</span>
                  </div>
                  <p className="text-lg font-medium text-gray-900">{question.question}</p>
                  {question.type === 'mcq' && question.options && (
                    <div className="mt-3 space-y-2">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center">
                          <input
                            type="radio"
                            name={`question-${index}`}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label className="ml-3 text-gray-700">{option}</label>
                        </div>
                      ))}
                    </div>
                  )}
                  {question.type === 'coding' && (
                    <div className="mt-3 bg-gray-100 p-4 rounded-lg">
                      <pre className="text-sm text-gray-700">
                        <code>{question.code || 'Code snippet will appear here.'}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">About AIQGen</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  AIQGen helps educators generate questions based on difficulty levels. Enter your text
                  and let AI create diverse questions to assess student understanding effectively.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;