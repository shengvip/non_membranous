import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Database, Settings, BarChart2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as xlsx from 'xlsx';

export default function Home() {
  const [data, setData] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('app_data') || '[]');
    } catch {
      return [];
    }
  });
  const [columns, setColumns] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('app_columns') || '[]');
    } catch {
      return [];
    }
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [allMetrics, setAllMetrics] = useState<any[] | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'training' | 'success' | 'error'>('idle');
  const [currentModel, setCurrentModel] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'app_data') {
        try {
          setData(JSON.parse(e.newValue || '[]'));
        } catch (err) {}
      }
      if (e.key === 'app_columns') {
        try {
          setColumns(JSON.parse(e.newValue || '[]'));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (fileToParse: File) => {
    setUploadStatus('uploading');
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const dataArray = new Uint8Array(buffer);
          const workbook = xlsx.read(dataArray, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const parsedData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
          
          if (parsedData.length > 0) {
            const cols = Object.keys(parsedData[0] as object);
            setData(parsedData);
            setColumns(cols);
            try {
              localStorage.setItem('app_data', JSON.stringify(parsedData));
              localStorage.setItem('app_columns', JSON.stringify(cols));
              setUploadStatus('success');
              setErrorMessage('');
            } catch (e) {
              setUploadStatus('error');
              setErrorMessage('文件过大，无法在本地存储中保存');
            }
          } else {
            setUploadStatus('error');
            setErrorMessage('文件为空或无法解析');
          }
        } catch (err) {
          console.error("Parse error:", err);
          setUploadStatus('error');
          setErrorMessage('解析文件失败: ' + (err as Error).message);
        }
      };
      reader.onerror = () => {
        setUploadStatus('error');
        setErrorMessage('读取文件失败');
      };
      reader.readAsArrayBuffer(fileToParse);
    } catch (error) {
      console.error("File read error:", error);
      setUploadStatus('error');
      setErrorMessage('读取文件失败: ' + (error as Error).message);
    }
  };

  const handleShowData = () => {
    if (data.length === 0) {
      setErrorMessage('暂无数据');
      return;
    }
    window.open('/data-viewer', '_blank');
  };

  const handleTrainModel = async (model: string) => {
    if (data.length === 0) {
      setTrainingStatus('error');
      setErrorMessage('没有可用于训练的数据，请先上传文件');
      return;
    }

    if (!columns.includes('level')) {
      setTrainingStatus('error');
      setErrorMessage('数据中未找到目标列 "level"');
      return;
    }

    setTrainingStatus('training');
    setCurrentModel(model);
    setMetrics(null);
    setAllMetrics(null);

    try {
      const response = await fetch('/api/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, data, columns }),
      });

      const result = await response.json();

      if (response.ok) {
        setMetrics(result.metrics);
        setTrainingStatus('success');
      } else {
        setTrainingStatus('error');
        setErrorMessage(result.error || '训练失败');
      }
    } catch (error) {
      setTrainingStatus('error');
      setErrorMessage('训练请求失败');
    }
  };

  const handleCompareModels = async () => {
    if (data.length === 0) {
      setTrainingStatus('error');
      setErrorMessage('没有可用于训练的数据，请先上传文件');
      return;
    }

    if (!columns.includes('level')) {
      setTrainingStatus('error');
      setErrorMessage('数据中未找到目标列 "level"');
      return;
    }

    setTrainingStatus('training');
    setCurrentModel('模型对比');
    setMetrics(null);
    setAllMetrics(null);

    try {
      const response = await fetch('/api/train-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, columns }),
      });

      const result = await response.json();

      if (response.ok) {
        setAllMetrics(result.results);
        setTrainingStatus('success');
      } else {
        setTrainingStatus('error');
        setErrorMessage(result.error || '训练失败');
      }
    } catch (error) {
      setTrainingStatus('error');
      setErrorMessage('训练请求失败');
    }
  };

  const models = [
    'XGBoost', 'CatBoost', 'random forest', 'decision tree', 
    'Elastic Net', 'LightGBM', '人工神经网络'
  ];

  const maxMetrics = useMemo(() => {
    if (!allMetrics || allMetrics.length === 0) return null;
    
    const maxVals = {
      accuracy: -Infinity,
      precision: -Infinity,
      recall: -Infinity,
      specificity: -Infinity,
      f1Score: -Infinity,
      mcc: -Infinity,
    };

    allMetrics.forEach(result => {
      maxVals.accuracy = Math.max(maxVals.accuracy, parseFloat(result.metrics.accuracy));
      maxVals.precision = Math.max(maxVals.precision, parseFloat(result.metrics.precision));
      maxVals.recall = Math.max(maxVals.recall, parseFloat(result.metrics.recall));
      maxVals.specificity = Math.max(maxVals.specificity, parseFloat(result.metrics.specificity));
      maxVals.f1Score = Math.max(maxVals.f1Score, parseFloat(result.metrics.f1Score));
      maxVals.mcc = Math.max(maxVals.mcc, parseFloat(result.metrics.mcc));
    });

    return maxVals;
  }, [allMetrics]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Banner / Logo Area */}
      <div className="w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center">
          <img 
            src="/src/top.png" 
            alt="广西医科大学 公共卫生学院 School of Public Health Guangxi Medical University" 
            className="h-20 object-contain"
            onError={(e) => {
              // Fallback if image is not uploaded yet
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<div class="text-3xl font-bold text-[#8B2323] tracking-wider flex flex-col"><span class="flex items-center gap-4"><span class="w-12 h-12 rounded-full bg-[#8B2323] text-white flex items-center justify-center text-xl">校徽</span>广西医科大学 <span class="text-2xl font-normal">公共卫生学院</span></span><span class="text-sm font-normal text-slate-500 mt-2">School of Public Health Guangxi Medical University</span></div>');
            }}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-8 py-12 px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <header className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold text-[#8B2323] tracking-tight">
            基于多源数据的肾病智能风险分层预测模型
          </h1>
          <div className="w-24 h-1 bg-[#8B2323] mx-auto rounded-full opacity-80"></div>
          <p className="text-slate-600 text-lg">上传患者数据，使用多种机器学习算法进行肾病风险分层预测模型</p>
        </header>

        {/* Main Actions */}
        <div className="bg-white p-8 rounded-xl shadow-sm border-t-4 border-t-[#8B2323] border-x border-b border-slate-200 flex flex-col items-center space-y-8">
          <div className="flex flex-wrap justify-center gap-6">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xls,.xlsx"
              className="hidden" 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === 'uploading'}
              className="px-8 py-3.5 bg-[#8B2323] text-white rounded-md hover:bg-[#7A1E1E] shadow-sm hover:shadow transition-all flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadStatus === 'uploading' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {file ? file.name : '上传文件'}
            </button>

            <button 
              onClick={handleShowData}
              className="px-8 py-3.5 bg-white text-[#8B2323] border border-[#8B2323] rounded-md hover:bg-slate-50 shadow-sm hover:shadow transition-all flex items-center gap-2 font-medium"
            >
              <Database className="w-5 h-5" />
              显示数据
            </button>

            <button 
              className="px-8 py-3.5 bg-slate-800 text-white rounded-md hover:bg-slate-900 shadow-sm hover:shadow transition-all flex items-center gap-2 font-medium"
            >
              <Settings className="w-5 h-5" />
              预测建模
            </button>
          </div>

          {uploadStatus === 'success' && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span>文件上传成功，可以进行数据查看或模型训练。</span>
            </div>
          )}
          
          {uploadStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Models Section */}
        <div className="bg-white p-8 rounded-xl shadow-sm border-t-4 border-t-[#8B2323] border-x border-b border-slate-200 space-y-6">
          <h2 className="text-xl font-bold text-[#8B2323] flex items-center gap-2 border-b border-slate-100 pb-4">
            <BarChart2 className="w-6 h-6" />
            模型训练与评估
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {models.map(model => (
              <button
                key={model}
                onClick={() => handleTrainModel(model)}
                disabled={trainingStatus === 'training'}
                className={`px-4 py-3 rounded-md border transition-all text-sm font-medium shadow-sm
                  ${currentModel === model && trainingStatus === 'training' 
                    ? 'bg-[#8B2323]/10 border-[#8B2323]/30 text-[#8B2323]' 
                    : 'bg-white border-slate-200 text-slate-700 hover:border-[#8B2323]/50 hover:text-[#8B2323]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {currentModel === model && trainingStatus === 'training' ? '训练中...' : model}
              </button>
            ))}
            <button
              onClick={handleCompareModels}
              disabled={trainingStatus === 'training'}
              className={`px-4 py-3 rounded-md border transition-all text-sm font-medium shadow-sm
                ${currentModel === '模型对比' && trainingStatus === 'training' 
                  ? 'bg-[#8B2323] border-[#8B2323] text-white' 
                  : 'bg-[#8B2323] border-[#8B2323] text-white hover:bg-[#7A1E1E] hover:border-[#7A1E1E]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {currentModel === '模型对比' && trainingStatus === 'training' ? '评估中...' : '模型对比'}
            </button>
          </div>

          {trainingStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg mt-4">
              <AlertCircle className="w-5 h-5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Single Model Metrics */}
          {metrics && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-bold text-[#8B2323] mb-4 border-l-4 border-[#8B2323] pl-3">{currentModel} 模型评估结果</h3>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Accuracy</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Precision</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Recall</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Specificity</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">F1 Score</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">MCC</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{metrics.accuracy}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{metrics.precision}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{metrics.recall}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{metrics.specificity}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{metrics.f1Score}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{metrics.mcc}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Models Comparison */}
          {allMetrics && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-bold text-[#8B2323] mb-4 border-l-4 border-[#8B2323] pl-3">模型对比结果</h3>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">模型名称</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Accuracy</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Precision</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Recall</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Specificity</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">F1 Score</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">MCC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMetrics.map((result, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 bg-white">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{result.model}</td>
                        <td className={`px-4 py-3 text-sm font-mono ${maxMetrics && parseFloat(result.metrics.accuracy) === maxMetrics.accuracy ? 'text-[#8B2323] font-bold' : 'text-slate-700'}`}>{result.metrics.accuracy}</td>
                        <td className={`px-4 py-3 text-sm font-mono ${maxMetrics && parseFloat(result.metrics.precision) === maxMetrics.precision ? 'text-[#8B2323] font-bold' : 'text-slate-700'}`}>{result.metrics.precision}</td>
                        <td className={`px-4 py-3 text-sm font-mono ${maxMetrics && parseFloat(result.metrics.recall) === maxMetrics.recall ? 'text-[#8B2323] font-bold' : 'text-slate-700'}`}>{result.metrics.recall}</td>
                        <td className={`px-4 py-3 text-sm font-mono ${maxMetrics && parseFloat(result.metrics.specificity) === maxMetrics.specificity ? 'text-[#8B2323] font-bold' : 'text-slate-700'}`}>{result.metrics.specificity}</td>
                        <td className={`px-4 py-3 text-sm font-mono ${maxMetrics && parseFloat(result.metrics.f1Score) === maxMetrics.f1Score ? 'text-[#8B2323] font-bold' : 'text-slate-700'}`}>{result.metrics.f1Score}</td>
                        <td className={`px-4 py-3 text-sm font-mono ${maxMetrics && parseFloat(result.metrics.mcc) === maxMetrics.mcc ? 'text-[#8B2323] font-bold' : 'text-slate-700'}`}>{result.metrics.mcc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
