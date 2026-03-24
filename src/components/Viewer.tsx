import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ARProject, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { Play, Image as ImageIcon, Camera, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const getYouTubeId = (url: string) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
};

export default function Viewer() {
  const [projects, setProjects] = useState<ARProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<ARProject | null>(null);
  const [searchParams] = useSearchParams();
  const scanId = searchParams.get('id');

  // AR Scanner State
  const [arStep, setArStep] = useState<'idle' | 'loading' | 'scanning' | 'tracked'>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'ar_projects'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ARProject[];
      
      setProjects(projectsData);
      setLoading(false);

      if (scanId && !activeProject) {
        const scannedProject = projectsData.find(p => p.id === scanId);
        if (scannedProject) {
          setActiveProject(scannedProject);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ar_projects');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [scanId]);

  // Handle Body Scroll Lock
  useEffect(() => {
    if (activeProject) {
      document.body.style.overflow = 'hidden';
      setArStep('idle');
      setLoadProgress(0);
      
      const isYt = getYouTubeId(activeProject.overlayVideoUrl);
      if (isYt) {
        setIsVideoReady(true);
      } else {
        setIsVideoReady(false);
      }
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [activeProject]);

  const ytId = activeProject ? getYouTubeId(activeProject.overlayVideoUrl) : null;

  // Handle Camera Stream Attachment
  useEffect(() => {
    if (arStep !== 'idle' && cameraRef.current && cameraStream) {
      cameraRef.current.srcObject = cameraStream;
    }
  }, [arStep, cameraStream]);

  // Transition from loading to scanning
  useEffect(() => {
    if (arStep === 'loading' && isVideoReady) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setLoadProgress(100);
      const timer = setTimeout(() => {
        setArStep('scanning');
        startTrackingSimulation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [arStep, isVideoReady]);

  const handleCanPlayThrough = () => {
    setIsVideoReady(true);
  };

  const startTrackingSimulation = () => {
    setTimeout(() => {
      setArStep('tracked');
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.error("Play failed", e));
      }
    }, 2500);
  };

  const startExperience = async () => {
    try {
      // Unlock audio/video playback immediately on user click
      if (videoRef.current) {
        videoRef.current.play().catch(e => console.warn("Autoplay unlock prevented:", e));
        videoRef.current.pause();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      setCameraStream(stream);
      
      if (isVideoReady) {
        setLoadProgress(100);
        setArStep('scanning');
        startTrackingSimulation();
      } else {
        setArStep('loading');
        progressIntervalRef.current = window.setInterval(() => {
          setLoadProgress(p => p >= 90 ? p : p + Math.random() * 15);
        }, 300);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Camera access is required for the AR experience.");
    }
  };

  const stopExperience = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setArStep('idle');
    setActiveProject(null);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-baby-pink-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-baby-pink"></div>
      </div>
    );
  }

  // AR Scanner View
  if (activeProject) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black z-[100] flex flex-col touch-none">
        {/* 3D AR Overlay Container */}
        <div className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${arStep === 'tracked' ? 'opacity-100' : 'opacity-0'}`}>
          <div 
            className="relative w-[85vw] max-w-md aspect-[4/5] bg-black/20 rounded-xl shadow-2xl overflow-hidden pointer-events-auto border border-white/10"
            style={{
              transform: arStep === 'tracked' 
                ? 'perspective(1000px) rotateX(10deg) rotateY(-5deg) translateZ(50px)' 
                : 'perspective(1000px) rotateX(30deg) rotateY(-20deg) translateZ(-200px)',
              transition: 'transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
              boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 182, 193, 0.2)'
            }}
          >
            {!ytId && (
              <video
                ref={videoRef}
                src={activeProject.overlayVideoUrl}
                loop
                muted
                playsInline
                crossOrigin="anonymous"
                onCanPlayThrough={handleCanPlayThrough}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            
            {ytId && arStep === 'tracked' && (
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}&controls=0&playsinline=1&mute=1`}
                allow="autoplay; encrypted-media"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
        </div>

        {arStep === 'idle' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-baby-pink-light p-6">
            <button 
              onClick={stopExperience}
              className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-md text-gray-900 z-40"
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8">
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">{activeProject.title}</h2>
              <p className="text-gray-500 mb-8">Point your camera at the trigger image to unlock the magic.</p>
              
              <div className="relative w-48 h-48 mx-auto mb-8 rounded-lg overflow-hidden border-4 border-baby-pink shadow-inner">
                <img 
                  src={activeProject.triggerImageUrl} 
                  alt="Trigger" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <button
                onClick={startExperience}
                className="w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-xl shadow-lg text-lg font-medium text-gray-900 bg-baby-pink hover:bg-baby-pink-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-baby-pink transition-all transform hover:scale-105"
              >
                <Camera className="mr-2 h-6 w-6" />
                Start Experience
              </button>
            </div>
          </div>
        )}

        {arStep !== 'idle' && (
          <div className="absolute inset-0 z-10 bg-black">
            {/* Camera Feed */}
            <video 
              ref={cameraRef}
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Loading Assets Overlay */}
            {arStep === 'loading' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm px-8">
                <div className="w-full max-w-xs">
                  <div className="flex justify-between text-white mb-2 text-sm font-medium tracking-wider uppercase">
                    <span>Loading Assets</span>
                    <span>{Math.round(loadProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-baby-pink transition-all duration-300 ease-out"
                      style={{ width: `${loadProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Scanning UI */}
            {arStep === 'scanning' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-white/50 border-dashed rounded-lg relative animate-pulse">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-baby-pink"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-baby-pink"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-baby-pink"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-baby-pink"></div>
                </div>
                <p className="text-white mt-8 font-medium tracking-widest uppercase text-sm animate-bounce drop-shadow-md">
                  Scanning...
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="absolute top-6 right-6 z-40 flex gap-4">
              {arStep === 'tracked' && (
                <button 
                  onClick={() => {
                    setArStep('scanning');
                    if (videoRef.current) videoRef.current.pause();
                    startTrackingSimulation();
                  }}
                  className="px-4 py-2 bg-black/50 backdrop-blur-md text-white border border-white/20 rounded-full text-sm font-medium hover:bg-black/70 transition-colors"
                >
                  Reset Tracking
                </button>
              )}
              <button 
                onClick={stopExperience}
                className="p-3 bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-baby-pink-light pb-12">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-4xl font-serif font-semibold text-gray-900">Paper Dreams Cebu</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto sm:px-6 lg:px-8 mt-8">
        {projects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow px-4">
            <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No AR Projects</h3>
            <p className="mt-1 text-sm text-gray-500">Check back later for new experiences.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 px-4 sm:px-0">
            {projects.map((project) => (
              <div key={project.id} className="bg-white overflow-hidden shadow rounded-lg flex flex-col">
                <div className="relative pb-[100%] bg-gray-100">
                  <img 
                    src={project.triggerImageUrl} 
                    alt={project.title} 
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => setActiveProject(project)}
                      className="bg-white rounded-full p-3 shadow-lg transform hover:scale-110 transition-transform"
                    >
                      <Play className="h-8 w-8 text-baby-pink ml-1" />
                    </button>
                  </div>
                </div>
                <div className="px-4 py-4 flex-grow flex flex-col justify-between">
                  <h3 className="text-lg font-medium text-gray-900 truncate">{project.title}</h3>
                  <button
                    onClick={() => setActiveProject(project)}
                    className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-900 bg-baby-pink hover:bg-baby-pink-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-baby-pink transition-colors"
                  >
                    View AR Experience
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
