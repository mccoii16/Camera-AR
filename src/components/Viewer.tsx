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
      <div className="flex items-center justify-center min-h-screen bg-baby-pink-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-baby-pink"></div>
      </div>
    );
  }

  // AR Scanner View
  if (activeProject) {
    if (arStep === 'idle') {
      return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black z-[100] flex flex-col touch-none">
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-baby-pink-light p-6">
            <button 
              onClick={() => setActiveProject(null)}
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
                onClick={() => setArStep('tracked')}
                className="w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-xl shadow-lg text-lg font-medium text-gray-900 bg-baby-pink hover:bg-baby-pink-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-baby-pink transition-all transform hover:scale-105"
              >
                <Camera className="mr-2 h-6 w-6" />
                Start Experience
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
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black z-[100] flex flex-col touch-none">
        <iframe 
          src={arUrl.toString()} 
          className="absolute inset-0 w-full h-full border-none"
          allow="camera; gyroscope; accelerometer; magnetometer; xr-spatial-tracking; microphone;"
        />
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
