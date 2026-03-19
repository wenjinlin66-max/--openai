
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Loader2, User, Save, X, Clock, ShieldCheck, UserPlus, Activity, Zap, Link, Search, Upload, Eye, EyeOff } from 'lucide-react';
import { analyzeCustomerImage } from '../services/geminiService';
import { logVisitor, updateCustomer } from '../services/dataService';
import { AnalysisResult, Customer, CustomerTier, VisitorLog } from '../types';

interface CustomerScannerProps {
  onCustomerIdentified: (customer: Customer) => void;
  onAddCustomer: (customer: Customer) => void;
  customers: Customer[];
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SCAN_INTERVAL = 1000; 
const MOTION_THRESHOLD = 50; 
// API Throttle: 3000ms (3s). This allows scanning a new person quickly 
// but prevents hitting Google's 15 RPM rate limit on the free tier.
const API_CALL_THROTTLE = 3000; 

const CustomerScanner: React.FC<CustomerScannerProps> = ({ onCustomerIdentified, onAddCustomer, customers, showToast = (_msg, _type) => {} }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null); 
  const previousFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  
  const lastAiCallTimeRef = useRef<number>(0);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(true); 
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [processing, setProcessing] = useState(false);
  const [motionDetected, setMotionDetected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [visitorLog, setVisitorLog] = useState<VisitorLog[]>([]);
  // Ref to access latest visitor log in processImage without adding it to dependencies
  const visitorLogRef = useRef<VisitorLog[]>([]); 
  const [error, setError] = useState<string>('');
  
  // Create Profile Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<AnalysisResult | null>(null); 
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    tier: CustomerTier.BRONZE,
    tags: '',
    notes: ''
  });

  // Bind Member Modal State
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindSearchQuery, setBindSearchQuery] = useState('');

  // Sync ref with state
  useEffect(() => {
    visitorLogRef.current = visitorLog;
  }, [visitorLog]);

  // 1. Auto-start Camera on Mount
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        setIsStreaming(true);
        setError('');
      } catch (err) {
        console.warn("Camera access failed or denied", err);
        setError('无法访问摄像头，请检查权限或使用照片上传');
      }
    };
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const setVideoNode = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
    }
  }, []);

  // Motion Detection Logic - Memoized
  const checkForMotion = useCallback((context: CanvasRenderingContext2D, width: number, height: number): boolean => {
    const imageData = context.getImageData(0, 0, width, height);
    const currentData = imageData.data;
    let score = 0;
    
    if (previousFrameDataRef.current) {
      const prevData = previousFrameDataRef.current;
      // Sampling optimization: check every 80th pixel
      for (let i = 0; i < currentData.length; i += 80) { 
        const rDiff = Math.abs(currentData[i] - prevData[i]);
        const gDiff = Math.abs(currentData[i+1] - prevData[i+1]);
        const bDiff = Math.abs(currentData[i+2] - prevData[i+2]);
        if (rDiff + gDiff + bDiff > 100) {
          score++;
        }
      }
    }

    previousFrameDataRef.current = Uint8ClampedArray.from(currentData); // Clone data
    return score > MOTION_THRESHOLD;
  }, []);

  // Core Logic: Visual Fingerprint Matching
  const findMatchingCustomer = useCallback((analysis: AnalysisResult, customersList: Customer[]): Customer | undefined => {
    if (!customersList || customersList.length === 0) return undefined;

    const features = [
      analysis.gender, 
      analysis.clothingStyle,
      ...(analysis.distinctiveFeatures ? analysis.distinctiveFeatures.split(/[,，]/) : [])
    ].filter(f => f && f !== '未知' && f.length > 1).map(f => f.trim().toLowerCase());

    if (features.length === 0) return undefined;

    let bestMatch: Customer | undefined;
    let maxScore = 0;

    customersList.forEach(customer => {
      const customerTags = (customer.tags.join(' ') + ' ' + customer.notes).toLowerCase();
      let score = 0;

      features.forEach(f => {
        if (customerTags.includes(f)) {
          score += 1;
          if (f.length > 2) score += 2;
        }
      });

      if (score > 3 && score > maxScore) {
        maxScore = score;
        bestMatch = customer;
      }
    });

    return bestMatch;
  }, []);

  const processImage = useCallback(async (base64Image: string, isManualUpload: boolean = false) => {
    if (processing) return;
    setProcessing(true);
    lastAiCallTimeRef.current = Date.now();

    try {
      const analysis = await analyzeCustomerImage(base64Image);
      
      // De-duplication Logic:
      // Only skip if it's essentially the SAME analysis result within a short window (2 mins).
      // This prevents log spamming for the same person standing there, 
      // but DOES NOT block a new person entering 5 seconds later.
      if (!isManualUpload) {
          const lastVisitor = visitorLogRef.current[0];
          const isDuplicate = lastVisitor && 
            lastVisitor.analysis.gender === analysis.gender &&
            lastVisitor.analysis.clothingStyle === analysis.clothingStyle &&
            (new Date().getTime() - lastVisitor.timestamp.getTime() < 120000); 

          if (isDuplicate) {
             setLastScanTime(new Date());
             setProcessing(false);
             return;
          }
      }

      const matchedCustomer = findMatchingCustomer(analysis, customers);

      if (matchedCustomer && !isManualUpload) {
         showToast(`识别成功: 欢迎回来, ${matchedCustomer.name}`, 'success');
      } 

      const newLog: VisitorLog = {
        id: Date.now().toString(),
        timestamp: new Date(),
        analysis: analysis,
        customer: matchedCustomer,
        isNew: !matchedCustomer
      };

      setVisitorLog(prev => [newLog, ...prev].slice(0, 20)); 
      setLastScanTime(new Date());

      await logVisitor(newLog);

      if (matchedCustomer) {
         onCustomerIdentified(matchedCustomer);
      }

    } catch (e) {
      console.error("Scan error", e);
      if (isManualUpload) showToast("分析失败，请重试", 'error');
    } finally {
      setProcessing(false);
    }
  }, [processing, customers, showToast, onCustomerIdentified, findMatchingCustomer]);


  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processing || !isMonitoring) return;

    const now = Date.now();
    // Only throttle based on API Rate Limits (3s), no visual lock.
    if (now - lastAiCallTimeRef.current < API_CALL_THROTTLE) return; 

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (context && video.readyState === 4) {
      canvas.width = 320; 
      canvas.height = 240;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 1. Check for Motion
      const hasMotion = checkForMotion(context, canvas.width, canvas.height);
      setMotionDetected(hasMotion);

      if (!hasMotion) {
        return; 
      }

      // 2. If motion detected, proceed to AI analysis
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64Image = dataUrl.split(',')[1];
      
      await processImage(base64Image, false);
    }
  }, [processing, isMonitoring, processImage, checkForMotion]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isStreaming && isMonitoring) {
        scanFrame();
      }
    }, SCAN_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isStreaming, isMonitoring, scanFrame]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = '';
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Image = base64String.split(',')[1];
      setIsMonitoring(false); 
      processImage(base64Image, true); 
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const handleCreateClick = (analysis: AnalysisResult) => {
    setPendingAnalysis(analysis);
    
    const tags = [
      analysis.gender,
      analysis.clothingStyle,
      ...(analysis.distinctiveFeatures ? analysis.distinctiveFeatures.split(/[,，]/).map(s => s.trim()) : [])
    ].filter(Boolean).join(', ');

    setNewCustomerForm({
      name: '',
      tier: CustomerTier.BRONZE,
      tags: tags,
      notes: `AI 视觉记忆: ${analysis.distinctiveFeatures || analysis.clothingStyle}。(${new Date().toLocaleDateString()})`
    });
    setShowCreateModal(true);
  };

  const handleBindClick = (analysis: AnalysisResult) => {
    setPendingAnalysis(analysis);
    setBindSearchQuery('');
    setShowBindModal(true);
  };

  const confirmBind = async (customer: Customer) => {
    if (!pendingAnalysis) return;
    setShowBindModal(false);
    
    const newFeatures = [
      pendingAnalysis.clothingStyle,
      ...(pendingAnalysis.distinctiveFeatures ? pendingAnalysis.distinctiveFeatures.split(/[,，]/) : [])
    ].map(s => s.trim());

    const updatedTags = Array.from(new Set([...customer.tags, ...newFeatures]));
    
    await updateCustomer(customer.id, { tags: updatedTags });
    showToast(`已关联会员: ${customer.name}`, 'success');

    const updatedCustomer = { ...customer, tags: updatedTags };

    setVisitorLog(prev => prev.map(log => {
      if (log.analysis === pendingAnalysis) {
        return { ...log, customer: updatedCustomer, isNew: false };
      }
      return log;
    }));
    
    onCustomerIdentified(updatedCustomer);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name) return;

    const newCustomer: Customer = {
      id: `c_${Date.now()}`,
      name: newCustomerForm.name,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(newCustomerForm.name)}&background=random`,
      tier: newCustomerForm.tier,
      tags: newCustomerForm.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean),
      visitCount: 1,
      totalSpent: 0,
      balance: 0,
      points: 0,
      lastVisit: new Date().toISOString().split('T')[0],
      notes: newCustomerForm.notes,
      preferences: [],
      history: []
    };

    onAddCustomer(newCustomer);
    setShowCreateModal(false);
    
    setVisitorLog(prev => prev.map(log => {
       if (log.analysis === pendingAnalysis) {
         return { ...log, customer: newCustomer, isNew: false };
       }
       return log;
    }));
  };

  const getTierStyle = (tier?: CustomerTier) => {
    switch (tier) {
      case CustomerTier.PLATINUM: return 'border-l-4 border-l-slate-800 bg-slate-50';
      case CustomerTier.GOLD: return 'border-l-4 border-l-amber-400 bg-amber-50/50';
      case CustomerTier.SILVER: return 'border-l-4 border-l-slate-300 bg-white';
      default: return 'border-l-4 border-l-blue-100 bg-white';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] gap-6">
      {/* LEFT: Intelligent Monitor (Dark Slate Style) */}
      <div className="lg:w-2/3 flex flex-col gap-4">
        <div 
          className={`relative bg-slate-900 rounded-lg overflow-hidden shadow-lg flex-1 group border border-slate-700 min-h-[400px] flex items-center justify-center transition-all duration-300 ${isDragging ? 'border-blue-500 ring-4 ring-blue-500/30' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isStreaming ? (
             <video 
               ref={setVideoNode} 
               autoPlay 
               playsInline 
               muted 
               className="w-full h-full object-cover opacity-90"
             />
          ) : (
             <div className="text-slate-500 flex flex-col items-center p-4 text-center">
                <Camera className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-sm">摄像头信号中断</p>
                <p className="text-xs mt-1 text-slate-600">请检查连接或拖入图像文件。</p>
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
             </div>
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Drag Overlay */}
          {isDragging && (
             <div className="absolute inset-0 z-50 bg-blue-900/40 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-blue-400 m-4 rounded-lg animate-pulse pointer-events-none">
                <Upload className="w-16 h-16 text-white mb-4" />
                <h3 className="text-xl font-bold text-white drop-shadow-md">释放以分析图像</h3>
             </div>
          )}

          {/* HUD Overlays (Professional Security Look) */}
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10 pointer-events-none">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded bg-black/50 border border-white/10 text-xs font-mono tracking-wider backdrop-blur-sm text-white`}>
               <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></div>
               {isMonitoring ? 'REC ● LIVE' : 'PAUSED'}
            </div>
            
            {isMonitoring && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono backdrop-blur-sm transition-all ${motionDetected ? 'bg-emerald-900/60 border-emerald-500 text-emerald-400' : 'bg-black/50 border-transparent text-slate-400'}`}>
                {motionDetected ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {motionDetected ? 'MOTION DETECTED' : 'NO ACTIVITY'}
              </div>
            )}

            {processing && (
               <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold backdrop-blur-md animate-fade-in shadow-sm">
                 <Loader2 className="w-3 h-3 animate-spin" />
                 ANALYZING...
               </div>
            )}
          </div>

          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
             <p className="text-slate-400 text-xs font-mono bg-black/40 px-2 py-1 rounded">
               LAST SCAN: {lastScanTime ? lastScanTime.toLocaleTimeString() : '--:--:--'} 
             </p>
          </div>

          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileUpload} 
               accept="image/*" 
               className="hidden" 
            />
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="p-2 rounded bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition-colors border border-white/10"
               title="上传图像"
            >
               <Upload className="w-4 h-4" />
            </button>
            <button 
               onClick={() => setIsMonitoring(!isMonitoring)}
               className="p-2 rounded bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition-colors border border-white/10"
               title={isMonitoring ? "暂停监测" : "恢复监测"}
            >
              {isMonitoring ? <Activity className="w-4 h-4" /> : <Activity className="w-4 h-4 opacity-50" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
           <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded text-blue-600"><User className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500">今日客流</p>
                <p className="text-lg font-bold text-slate-800">{visitorLog.length} 人</p>
              </div>
           </div>
           <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded text-emerald-600"><ShieldCheck className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500">会员识别</p>
                <p className="text-lg font-bold text-slate-800">{visitorLog.filter(v => v.customer).length} 人</p>
              </div>
           </div>
           <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded text-amber-600"><Zap className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500">状态</p>
                <p className="text-lg font-bold text-slate-800">{motionDetected ? '监控中' : '待机'}</p>
              </div>
           </div>
        </div>
      </div>

      {/* RIGHT: Live Visitor Stream (Clean List) */}
      <div className="lg:w-1/3 bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-blue-600" /> 访客记录流水
          </h3>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Live</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-slate-50/50">
          {visitorLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
               <Activity className="w-12 h-12 mb-2 stroke-1" />
               <p className="text-sm">暂无访客记录</p>
               <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="text-blue-600 text-xs border border-blue-200 bg-white px-3 py-1.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-2"
                  >
                      <Upload className="w-3 h-3" /> 模拟识别
                  </button>
               </div>
            </div>
          ) : (
            visitorLog.map((log) => (
              <div 
                key={log.id} 
                className={`relative p-4 rounded-lg shadow-sm border bg-white transition-all animate-slide-in-right hover:shadow-md ${getTierStyle(log.customer?.tier)}`}
              >
                <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-400">
                  {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>

                {log.customer ? (
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <img 
                        src={log.customer.avatarUrl} 
                        alt={log.customer.name} 
                        className={`w-10 h-10 rounded object-cover border ${log.customer.tier === CustomerTier.GOLD || log.customer.tier === CustomerTier.PLATINUM ? 'border-amber-400' : 'border-slate-200'}`}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border border-white">
                        <ShieldCheck className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                         <h4 className="text-sm font-bold text-slate-900 truncate">{log.customer.name}</h4>
                         <span className="text-[10px] text-slate-500 truncate">{log.customer.tier}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-snug bg-blue-50/50 p-2 rounded border border-blue-100 mt-2">
                        <span className="font-semibold text-blue-700">Suggestion:</span> {log.analysis.suggestedAction}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                     <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                        <User className="w-5 h-5" />
                     </div>
                     <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                           <h4 className="text-sm font-bold text-slate-700">陌生访客</h4>
                           <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded border border-slate-200">New</span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                           <p className="leading-snug mt-1 text-slate-600">
                             特征: {log.analysis.distinctiveFeatures || log.analysis.clothingStyle}
                           </p>
                        </div>
                        <div className="flex gap-2 mt-2">
                           <button 
                             onClick={() => handleCreateClick(log.analysis)}
                             className="flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                           >
                             <UserPlus className="w-3 h-3" /> 建档
                           </button>
                           <button 
                             onClick={() => handleBindClick(log.analysis)}
                             className="flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors"
                           >
                             <Link className="w-3 h-3" /> 关联
                           </button>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-[90%] max-w-md overflow-hidden animate-fade-in-up">
             <div className="bg-blue-600 p-4 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                  <UserPlus className="w-4 h-4" /> 新建客户档案
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-blue-100 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
             </div>
             
             <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">客户姓名 <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={newCustomerForm.name}
                    onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})}
                    placeholder="请输入姓名"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">会员等级</label>
                    <select 
                      value={newCustomerForm.tier}
                      onChange={e => setNewCustomerForm({...newCustomerForm, tier: e.target.value as CustomerTier})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                    >
                       {Object.values(CustomerTier).map(tier => (
                         <option key={tier} value={tier}>{tier}</option>
                       ))}
                    </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">视觉标签</label>
                     <input 
                        type="text" 
                        value={newCustomerForm.tags}
                        onChange={e => setNewCustomerForm({...newCustomerForm, tags: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                      />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">备注信息</label>
                  <textarea 
                    rows={3}
                    value={newCustomerForm.notes}
                    onChange={e => setNewCustomerForm({...newCustomerForm, notes: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-900"
                  ></textarea>
                </div>

                <div className="pt-2 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 border border-slate-300 text-slate-600 rounded font-medium hover:bg-slate-50 transition-colors text-sm"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    保存档案
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Bind Member Modal */}
      {showBindModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-[90%] max-w-md overflow-hidden animate-fade-in-up">
             <div className="bg-slate-800 p-4 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                  <Link className="w-4 h-4" /> 关联已有会员
                </h3>
                <button onClick={() => setShowBindModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
             </div>
             
             <div className="p-6">
                <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded border border-slate-100">
                  关联后，系统将更新该客户的视觉特征（{pendingAnalysis?.distinctiveFeatures || pendingAnalysis?.clothingStyle}）。
                </p>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={bindSearchQuery}
                    onChange={e => setBindSearchQuery(e.target.value)}
                    placeholder="搜索姓名、手机号..."
                    autoFocus
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded divide-y divide-slate-50 mb-4">
                   {customers.filter(c => c.name.toLowerCase().includes(bindSearchQuery.toLowerCase())).length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">未找到匹配客户</div>
                   ) : (
                      customers
                        .filter(c => c.name.toLowerCase().includes(bindSearchQuery.toLowerCase()))
                        .slice(0, 5)
                        .map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => confirmBind(c)}
                            className="p-3 flex items-center gap-3 hover:bg-blue-50 cursor-pointer transition-colors"
                          >
                             <img src={c.avatarUrl} alt={c.name} className="w-8 h-8 rounded bg-slate-200 object-cover" />
                             <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800">{c.name}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                   <span className="bg-slate-100 px-1 rounded">{c.tier}</span>
                                </div>
                             </div>
                             <button className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors">关联</button>
                          </div>
                        ))
                   )}
                </div>
                <button 
                  onClick={() => setShowBindModal(false)}
                  className="w-full py-2 border border-slate-200 text-slate-600 rounded font-medium hover:bg-slate-50 transition-colors text-sm"
                >
                  取消
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerScanner;