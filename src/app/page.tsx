'use client';

import { useState, useRef } from 'react';
import { FiUpload, FiCheck, FiX, FiInfo, FiDownload, FiUsers, FiBuilding } from 'react-icons/fi';
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
  processedCompanies?: string[];
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
    processedCompanies: string[];
    processingTime: string;
  } | null>(null);
  const [groupedResults, setGroupedResults] = useState<{[company: string]: ProfileResult[]}>({});
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
    setGroupedResults({});
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setResults([]);
    setProcessingStats(null);
    setGroupedResults({});

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
        text: `Processing ${cleanedCompanies.length} companies. This may take several minutes...`, 
        type: 'info' 
      });

      // Send to webhook
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

        // Group results by company
        const grouped: {[company: string]: ProfileResult[]} = {};
        result.profiles.forEach(profile => {
          const companyKey = profile.search_company || 'Unknown Company';
          if (!grouped[companyKey]) {
            grouped[companyKey] = [];
          }
          grouped[companyKey].push(profile);
        });

        setResults(result.profiles);
        setGroupedResults(grouped);
        setProcessingStats({
          totalCompanies: result.totalCompanies || 0,
          totalProfiles: result.totalProfiles || 0,
          processedCompanies: result.processedCompanies || [],
          processingTime: `${processingTime}s`
        });

        setMessage({
          text: `🎉 Success! Found ${result.totalProfiles} profiles across ${result.processedCompanies?.length || 0} companies`,
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
    a.download = `linkedin_profiles_all_companies_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-6xl space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">LinkedIn Profile Scraper</h1>
          <h2 className="text-xl font-semibold text-blue-600 mb-4">V1.4 - ALL Companies Edition</h2>
          <p className="text-gray-600">Upload a CSV with company names and regions to find LinkedIn profiles from ALL companies</p>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
              file ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
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
                    <span className="font-medium text-green-600">{file.name}</span> selected ✓
                  </>
                ) : (
                  'Click to select a CSV file'
                )}
              </p>
              <p className="text-xs text-gray-500">CSV format: Company Name, Region, Max Results (optional)</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !file}
            className={`w-full py-4 px-6 rounded-lg font-medium text-white transition-all transform ${
              isLoading 
                ? 'bg-blue-400 scale-95' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-105'
            } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-6 w-6 text-white"
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
                Processing ALL Companies...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <FiUsers className="mr-2 h-5 w-5" />
                Start Scraping ALL Company Profiles
              </span>
            )}
          </button>
        </form>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm border-l-4 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border-green-400'
                : message.type === 'error'
                ? 'bg-red-50 text-red-700 border-red-400'
                : 'bg-blue-50 text-blue-700 border-blue-400'
            }`}
          >
            <div className="flex items-center">
              {message.type === 'success' ? (
                <FiCheck className="mr-2 flex-shrink-0 h-5 w-5" />
              ) : message.type === 'error' ? (
                <FiX className="mr-2 flex-shrink-0 h-5 w-5" />
              ) : (
                <FiInfo className="mr-2 flex-shrink-0 h-5 w-5" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}

        {processingStats && (
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-lg border">
            <h3 className="font-bold text-gray-800 mb-4 text-lg">📊 Processing Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="flex items-center mb-1">
                  <FiBuilding className="text-blue-500 mr-2" />
                  <span className="text-gray-600">Companies:</span>
                </div>
                <span className="font-bold text-xl text-blue-600">{processingStats.totalCompanies}</span>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="flex items-center mb-1">
                  <FiUsers className="text-green-500 mr-2" />
                  <span className="text-gray-600">Profiles:</span>
                </div>
                <span className="font-bold text-xl text-green-600">{processingStats.totalProfiles}</span>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <span className="text-gray-600">Processed:</span>
                <span className="font-bold text-lg text-purple-600 ml-2">{processingStats.processedCompanies.length}</span>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <span className="text-gray-600">Time:</span>
                <span className="font-bold text-lg text-orange-600 ml-2">{processingStats.processingTime}</span>
              </div>
            </div>
            {processingStats.processedCompanies.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Companies processed:</p>
                <div className="flex flex-wrap gap-2">
                  {processingStats.processedCompanies.map((company, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      {company}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {Object.keys(groupedResults).length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-800">
                Results by Company ({results.length} total profiles)
              </h3>
              <button
                onClick={downloadResults}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-md"
              >
                <FiDownload className="h-4 w-4" />
                <span>Download All Results</span>
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedResults).map(([company, profiles]) => (
                <div key={company} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b">
                    <h4 className="text-lg font-semibold text-gray-800 flex items-center">
                      <FiBuilding className="mr-2 text-blue-500" />
                      {company} 
                      <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                        {profiles.length} profiles
                      </span>
                    </h4>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Title</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">LinkedIn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {profiles.map((profile, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{profile.name}</td>
                            <td className="px-4 py-2 text-gray-700">{profile.title}</td>
                            <td className="px-4 py-2 text-gray-700 text-xs">{profile.email}</td>
                            <td className="px-4 py-2">
                              <a
                                href={profile.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs"
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
