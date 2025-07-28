'use client';

import { useState, useRef } from 'react';
import { FiUpload, FiCheck, FiX, FiInfo, FiDownload } from 'react-icons/fi';
import Papa from 'papaparse';

interface ProfileResult {
  name: string;
  title: string;
  snippet: string;
  url: string;
  email: string;
  startDate: string;
  duration: string;
  search_company: string;
  search_region: string;
}

interface ProcessingResponse {
  status: string;
  message: string;
  totalCompanies?: number;
  totalProfiles?: number;
  profiles?: ProfileResult[];
  timestamp?: string;
}

export default function CompanyScraperUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [processingStats, setProcessingStats] = useState<{
    totalCompanies: number;
    totalProfiles: number;
    processingTime: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setMessage({ text: 'Please upload a CSV file', type: 'error' });
      return;
    }

    setFile(selectedFile);
    setMessage({ text: `Ready to upload: ${selectedFile.name}`, type: 'info' });
    setResults([]);
    setProcessingStats(null);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setResults([]);
    setProcessingStats(null);

    const startTime = Date.now();

    try {
      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
      });

      // Clean and validate CSV rows
      const cleanedCompanies = parsed.data
        .filter((company: any) => company['Company Name'] && company['Region'])
        .map((company: any) => ({
          'Company Name': company['Company Name'].trim(),
          'Region': company['Region'].trim(),
          'Max Results': parseInt(company['Max Results']) || 20
        }));

      if (cleanedCompanies.length === 0) {
        throw new Error('No valid rows found in the CSV. Make sure each row includes "Company Name" and "Region".');
      }

      setMessage({ 
        text: `Processing ${cleanedCompanies.length} companies. This may take a few minutes...`, 
        type: 'info' 
      });

      // Optional: log payload
      console.log('Sending to webhook:', cleanedCompanies);

      const response = await fetch('https://noureyeotech.app.n8n.cloud/webhook-test/205690e7-c532-45e4-92c8-c3bd21b44c58', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: cleanedCompanies }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ProcessingResponse = await response.json();

      if (result.status === 'success' && result.profiles) {
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

        setResults(result.profiles);
        setProcessingStats({
          totalCompanies: result.totalCompanies || 0,
          totalProfiles: result.totalProfiles || 0,
          processingTime: `${processingTime}s`
        });

        setMessage({
          text: `Success! Found ${result.totalProfiles} profiles across ${result.totalCompanies} companies`,
          type: 'success',
        });
      } else {
        throw new Error(result.message || 'Processing failed');
      }
    } catch (err: any) {
      setMessage({
        text: err.message || 'Failed to process file',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFile(null);
    }
  };

  const downloadResults = () => {
    if (results.length === 0) return;

    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_profiles_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">Company Profile Scraper</h1>
          <p className="text-gray-600 mt-2">Upload a CSV with company names and regions to find LinkedIn profiles</p>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".csv" 
              required 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <FiUpload className={`h-8 w-8 ${file ? 'text-green-500' : 'text-gray-400'}`} />
              <p className="text-sm text-gray-600">
                {file ? (
                  <>
                    <span className="font-medium text-green-600">{file.name}</span> selected
                  </>
                ) : (
                  'Click to select a CSV file'
                )}
              </p>
              <p className="text-xs text-gray-500">CSV should contain: Company Name, Region, Max Results</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !file}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing All Companies...
              </span>
            ) : (
              'Start Scraping All Profiles'
            )}
          </button>
        </form>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            <div className="flex items-center">
              {message.type === 'success' ? (
                <FiCheck className="mr-2 flex-shrink-0" />
              ) : message.type === 'error' ? (
                <FiX className="mr-2 flex-shrink-0" />
              ) : (
                <FiInfo className="mr-2 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {processingStats && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">Processing Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Companies:</span>
                <span className="font-medium ml-2">{processingStats.totalCompanies}</span>
              </div>
              <div>
                <span className="text-gray-600">Profiles:</span>
                <span className="font-medium ml-2">{processingStats.totalProfiles}</span>
              </div>
              <div>
                <span className="text-gray-600">Time:</span>
                <span className="font-medium ml-2">{processingStats.processingTime}</span>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-800">
                Results ({results.length} profiles)
              </h3>
              <button
                onClick={downloadResults}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiDownload className="h-4 w-4" />
                <span>Download CSV</span>
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Title</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Company</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">LinkedIn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((profile, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{profile.name}</td>
                      <td className="px-4 py-2 text-gray-700">{profile.title}</td>
                      <td className="px-4 py-2 text-gray-700">{profile.search_company}</td>
                      <td className="px-4 py-2 text-gray-700">{profile.email}</td>
                      <td className="px-4 py-2">
                        <a
                          href={profile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Profile
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
