import React, { useState, useEffect } from 'react';
import { Save, Search, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DataViewer() {
  const [localData, setLocalData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<'all' | 'missing'>('all');
  const [missingRows, setMissingRows] = useState<number[]>([]);
  const [missingCols, setMissingCols] = useState<string[]>([]);

  useEffect(() => {
    try {
      const storedData = JSON.parse(localStorage.getItem('app_data') || '[]');
      const storedCols = JSON.parse(localStorage.getItem('app_columns') || '[]');
      setLocalData(storedData);
      setColumns(storedCols);
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
    }
  }, []);

  const handleCellChange = (rowIndex: number, colName: string, value: string) => {
    const newData = [...localData];
    newData[rowIndex] = { ...newData[rowIndex], [colName]: value };
    setLocalData(newData);
  };

  const isMissing = (val: any) => {
    if (val === null || val === undefined || val === '') return true;
    const strVal = String(val).trim().toLowerCase();
    return ['n/a', 'nan', 'na', 'null'].includes(strVal);
  };

  const handleViewMissing = () => {
    const mRows: number[] = [];
    const mCols = new Set<string>();

    localData.forEach((row, idx) => {
      let rowHasMissing = false;
      columns.forEach((col: string) => {
        if (isMissing(row[col])) {
          rowHasMissing = true;
          mCols.add(col);
        }
      });
      if (rowHasMissing) {
        mRows.push(idx);
      }
    });

    setMissingRows(mRows);
    setMissingCols(Array.from(mCols));
    setViewMode('missing');
  };

  const handleReplaceWithMean = () => {
    const newData = [...localData];
    
    columns.forEach((col: string) => {
      // Calculate mean for numeric columns
      let sum = 0;
      let count = 0;
      let isNumeric = true;

      newData.forEach(row => {
        const val = row[col];
        if (!isMissing(val)) {
          const num = Number(val);
          if (!isNaN(num)) {
            sum += num;
            count++;
          } else {
            isNumeric = false;
          }
        }
      });

      if (isNumeric && count > 0) {
        const mean = (sum / count).toFixed(4);
        newData.forEach((row, idx) => {
          if (isMissing(row[col])) {
            newData[idx] = { ...newData[idx], [col]: mean };
          }
        });
      }
    });

    setLocalData(newData);
    setViewMode('all');
  };

  const handleReplaceWithMode = () => {
    const newData = [...localData];
    
    columns.forEach((col: string) => {
      const frequency: Record<string, number> = {};
      let maxFreq = 0;
      let mode = '';

      newData.forEach(row => {
        const val = row[col];
        if (!isMissing(val)) {
          const strVal = String(val);
          frequency[strVal] = (frequency[strVal] || 0) + 1;
          if (frequency[strVal] > maxFreq) {
            maxFreq = frequency[strVal];
            mode = strVal;
          }
        }
      });

      if (mode !== '') {
        newData.forEach((row, idx) => {
          if (isMissing(row[col])) {
            newData[idx] = { ...newData[idx], [col]: mode };
          }
        });
      }
    });

    setLocalData(newData);
    setViewMode('all');
  };

  const handleSaveAndReturn = async () => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('app_data', JSON.stringify(localData));
      setSaveStatus('success');
      setTimeout(() => {
        window.close();
      }, 500);
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleBack = () => {
    window.close();
  };

  if (localData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-xl font-medium text-slate-700">暂无数据</h2>
          <p className="text-slate-500">请先在主页上传数据文件</p>
          <button 
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            关闭当前页
          </button>
        </div>
      </div>
    );
  }

  const displayData = viewMode === 'missing' ? missingRows.map(idx => ({ ...localData[idx], _originalIndex: idx })) : localData.map((row, idx) => ({ ...row, _originalIndex: idx }));
  const displayCols = viewMode === 'missing' ? missingCols : columns;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">数据视图</h1>
        
        <div className="flex items-center gap-3">
          {viewMode === 'missing' && (
            <button 
              onClick={() => setViewMode('all')}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              显示全部数据
            </button>
          )}
          <button 
            onClick={handleViewMissing}
            className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            查看缺失值
          </button>
          <button 
            onClick={handleReplaceWithMean}
            className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            用均值填充
          </button>
          <button 
            onClick={handleReplaceWithMode}
            className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            用众数填充
          </button>
          <button 
            onClick={handleSaveAndReturn}
            disabled={saveStatus === 'saving'}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveStatus === 'saving' ? '保存中...' : '保存并返回'}
          </button>
        </div>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-emerald-50 text-emerald-600 px-6 py-2 flex items-center gap-2 text-sm border-b border-emerald-100">
          <CheckCircle2 className="w-4 h-4" />
          保存成功，即将关闭页面...
        </div>
      )}
      
      {saveStatus === 'error' && (
        <div className="bg-red-50 text-red-600 px-6 py-2 flex items-center gap-2 text-sm border-b border-red-100">
          <AlertCircle className="w-4 h-4" />
          保存失败，请重试
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-auto p-6">
        {displayData.length === 0 ? (
          <div className="text-center text-slate-500 mt-20">
            {viewMode === 'missing' ? '没有发现缺失值' : '暂无数据'}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 border-r border-slate-200 z-10 w-16 text-center">
                      #
                    </th>
                    {displayCols.map(col => (
                      <th key={col} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayData.map((row) => (
                    <tr key={row._originalIndex} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-2 text-xs text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100 text-center">
                        {row._originalIndex + 1}
                      </td>
                      {displayCols.map(col => {
                        const val = row[col];
                        const missing = isMissing(val);
                        return (
                          <td key={col} className={`px-4 py-2 ${missing ? 'bg-amber-50/50' : ''}`}>
                            <input
                              type="text"
                              value={val === null || val === undefined ? '' : val}
                              onChange={(e) => handleCellChange(row._originalIndex, col, e.target.value)}
                              className={`w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1 text-sm font-mono
                                ${missing ? 'text-amber-600 placeholder-amber-300' : 'text-slate-700'}`}
                              placeholder={missing ? 'NaN' : ''}
                            />
                          </td>
                        );
                      })}
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
