import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ARProject, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { Trash2, Plus, LogOut, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminPanel({ user }: { user: User }) {
  const [projects, setProjects] = useState<ARProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'ar_projects'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ARProject[];
      
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ar_projects');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !imageUrl || !videoUrl) {
      setError('Please fill all fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await addDoc(collection(db, 'ar_projects'), {
        title,
        triggerImageUrl: imageUrl,
        overlayVideoUrl: videoUrl,
        createdAt: Date.now(),
        authorEmail: user.email,
      });

      setTitle('');
      setImageUrl('');
      setVideoUrl('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'ar_projects');
      setError(err.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: ARProject) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await deleteDoc(doc(db, 'ar_projects', project.id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `ar_projects/${project.id}`);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-baby-pink-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-baby-pink"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-baby-pink-light pb-12">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-serif font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto sm:px-6 lg:px-8 mt-8">
        <div className="bg-white shadow sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Create New AR Project</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Provide online links for your trigger image and overlay video (e.g., YouTube, Imgur, AWS).</p>
            </div>
            
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">Project Title</label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 shadow-sm focus:ring-baby-pink focus:border-baby-pink block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                  placeholder="e.g., Cebu Ocean Park AR"
                />
              </div>

              <div>
                <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">Trigger Image URL</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    name="imageUrl"
                    id="imageUrl"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="focus:ring-baby-pink focus:border-baby-pink block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700">Overlay Video URL (Direct MP4 or YouTube Link)</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    name="videoUrl"
                    id="videoUrl"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="focus:ring-baby-pink focus:border-baby-pink block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                    placeholder="https://example.com/video.mp4 OR https://youtube.com/watch?v=..."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-baby-pink hover:bg-baby-pink-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-baby-pink disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Manage Projects</h3>
            
            {projects.length === 0 ? (
              <p className="text-gray-500 text-sm">No projects found.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <li key={project.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="mr-4 bg-white p-1 rounded shadow-sm border border-gray-100">
                        <QRCodeSVG value={`${window.location.origin}/scan?id=${project.id}`} size={64} />
                      </div>
                      <img src={project.triggerImageUrl} alt="" className="h-16 w-16 rounded object-cover" referrerPolicy="no-referrer" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">{project.title}</p>
                        <p className="text-sm text-gray-500">Created: {new Date(project.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-400 mt-1 break-all max-w-xs">{`${window.location.origin}/scan?id=${project.id}`}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(project)}
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
