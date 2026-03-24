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
  
  // 3DoF Tracking State
  const [transform, setTransform] = useState({ x: 0, y: 0, rotate: 0 });
  const initialOrientationRef = useRef<{alpha: number, beta: number, gamma: number} | null>(null);
  
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

  // Handle messages from AR iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'close-ar') {
        setArStep('idle');
        setActiveProject(null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  // AR Scanner View
  if (activeProject) {
    if (arStep === 'idle') {
      return (
        <div className="fixed inset-0 z-[100] bg-black touch-none" style={{ width: '100vw', height: '100dvh' }}>
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6">
            {/* Blurred background of the trigger image */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110"
              style={{ backgroundImage: `url(${activeProject.triggerImageUrl})` }}
            />
            <div className="absolute inset-0 bg-black/40" />
            
            <button 
              onClick={() => setActiveProject(null)}
              className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-lg text-white z-40 hover:bg-white/20 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="relative z-10 max-w-sm w-full bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden text-center p-8 border border-white/20">
              <div className="relative w-40 h-40 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg ring-4 ring-pink-50">
                <img 
                  src={activeProject.triggerImageUrl} 
                  alt="Trigger" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">{activeProject.title}</h2>
              <p className="text-gray-500 mb-8 text-sm leading-relaxed">
                Point your camera at this image in the real world to unlock the magic.
              </p>
              
              <button
                onClick={() => setArStep('tracked')}
                className="w-full flex items-center justify-center py-4 px-6 rounded-2xl shadow-lg text-lg font-semibold text-white bg-gray-900 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Camera className="mr-2 h-5 w-5" />
                Launch Camera
              </button>
            </div>
          </div>
        </div>
      );
    }

    const arUrl = new URL('/ar.html', window.location.origin);
    arUrl.searchParams.set('image', activeProject.triggerImageUrl);
    if (ytId) {
      arUrl.searchParams.set('ytId', ytId);
    } else {
      arUrl.searchParams.set('video', activeProject.overlayVideoUrl);
    }

    return (
      <div className="fixed inset-0 z-[100] bg-black touch-none" style={{ width: '100vw', height: '100dvh' }}>
        <iframe 
          src={arUrl.toString()} 
          className="w-full h-full border-none block"
          allow="camera; gyroscope; accelerometer; magnetometer; xr-spatial-tracking; microphone;"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-20 font-sans">
      <header className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 tracking-tight mb-3">
          Paper Dreams Cebu
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base">
          Bring your memories to life. Select an experience below and point your camera at the artwork.
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        {projects.length === 0 ? (
          <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-3xl border border-pink-100 shadow-sm px-4">
            <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="h-8 w-8 text-pink-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No Experiences Yet</h3>
            <p className="mt-2 text-sm text-gray-500">Check back later for new AR magic.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className="group relative bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 flex flex-col cursor-pointer transform hover:-translate-y-1"
                onClick={() => setActiveProject(project)}
              >
                <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden">
                  <img 
                    src={project.triggerImageUrl} 
                    alt={project.title} 
                    className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                    <div className="bg-white/20 backdrop-blur-md rounded-full p-4 shadow-2xl border border-white/30">
                      <Play className="h-8 w-8 text-white ml-1" />
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-grow flex flex-col justify-between bg-white relative z-10">
                  <h3 className="text-xl font-semibold text-gray-900 line-clamp-1 mb-1">{project.title}</h3>
                  <p className="text-sm text-pink-500 font-medium flex items-center">
                    <Camera className="w-4 h-4 mr-1.5" />
                    Tap to experience
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
