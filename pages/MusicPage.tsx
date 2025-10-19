import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MusicTrack, Role } from '../types';
import { getMusicTracks, addMusicTrack, deleteMusicTrack } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import DJPlayer from '../components/DJPlayer';
import { CloudArrowUpIcon, TrashIcon } from '../components/icons/Icons';

const MusicPage: React.FC = () => {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuth();
  
  // DJ Deck State
  const [trackA, setTrackA] = useState<MusicTrack | null>(null);
  const [trackB, setTrackB] = useState<MusicTrack | null>(null);
  const [crossfader, setCrossfader] = useState(0); // -1 for A, 1 for B, 0 for center

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const deckAGainRef = useRef<GainNode | null>(null);
  const deckBGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    // Initialize single AudioContext for the entire component
    if (!audioContextRef.current) {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = context;

        const gainA = context.createGain();
        gainA.connect(context.destination);
        deckAGainRef.current = gainA;

        const gainB = context.createGain();
        gainB.connect(context.destination);
        deckBGainRef.current = gainB;
    }
    // No cleanup needed, context persists for component lifetime
  }, []);

  useEffect(() => {
    // Crossfader logic (Equal-power crossfade)
    if (deckAGainRef.current && deckBGainRef.current) {
      const value = (crossfader + 1) / 2; // Map from [-1, 1] to [0, 1]
      deckAGainRef.current.gain.value = Math.cos(value * 0.5 * Math.PI);
      deckBGainRef.current.gain.value = Math.cos((1 - value) * 0.5 * Math.PI);
    }
  }, [crossfader]);


  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const trackData = await getMusicTracks();
      setTracks(trackData);
    } catch (error) {
      console.error("Failed to fetch music tracks:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'audio/mpeg') {
      setIsUploading(true);
      try {
        await addMusicTrack(file);
        await fetchTracks();
      } catch (error) {
        console.error("Failed to upload track", error);
        alert("Falha no upload da música.");
      } finally {
        setIsUploading(false);
      }
    } else {
        alert("Por favor, selecione um arquivo .mp3");
    }
    e.target.value = '';
  };
  
  const loadTrack = (track: MusicTrack, deck: 'A' | 'B') => {
    if (deck === 'A') {
      setTrackA(track);
    } else {
      setTrackB(track);
    }
  };

  const handleDelete = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza que deseja apagar esta música?")) {
        await deleteMusicTrack(trackId);
        await fetchTracks();
        if(trackA?.id === trackId) setTrackA(null);
        if(trackB?.id === trackId) setTrackB(null);
    }
  }

  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.ADMIN_MASTER;

  if (!isAdmin) {
      return (
          <div className="py-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Central de Música</h1>
            <p className="text-gray-500">Acesso restrito ao DJ.</p>
          </div>
      )
  }

  // DJ Panel View
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-2">Painel do DJ</h1>
      <p className="text-gray-500 mb-6">Controle os dois decks e mixe as músicas para todos.</p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {trackA && audioContextRef.current && deckAGainRef.current ? (
          <DJPlayer key={trackA.id} track={trackA} onStop={() => setTrackA(null)} deckId="A" audioContext={audioContextRef.current} destinationNode={deckAGainRef.current} />
        ) : (
          <div className="p-8 text-center bg-gray-100 dark:bg-gray-800 rounded-lg h-full flex flex-col justify-center">
            <p className="font-bold text-lg">DECK A</p>
            <p className="text-sm text-gray-500">Carregue uma música da biblioteca.</p>
          </div>
        )}
        {trackB && audioContextRef.current && deckBGainRef.current ? (
          <DJPlayer key={trackB.id} track={trackB} onStop={() => setTrackB(null)} deckId="B" audioContext={audioContextRef.current} destinationNode={deckBGainRef.current} />
        ) : (
          <div className="p-8 text-center bg-gray-100 dark:bg-gray-800 rounded-lg h-full flex flex-col justify-center">
            <p className="font-bold text-lg">DECK B</p>
            <p className="text-sm text-gray-500">Carregue uma música da biblioteca.</p>
          </div>
        )}
      </div>
      
      <div className="my-6 px-4 py-2 bg-gray-200 dark:bg-gray-900 rounded-lg flex items-center justify-center gap-4">
          <span className="font-bold text-lg">A</span>
          <input 
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={crossfader}
            onChange={(e) => setCrossfader(parseFloat(e.target.value))}
            className="w-full max-w-sm h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
          <span className="font-bold text-lg">B</span>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Biblioteca de Músicas</h2>
        <label htmlFor="track-upload" className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600 mb-4">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <CloudArrowUpIcon className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Clique para fazer upload</span> ou arraste e solte</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Apenas arquivos .MP3</p>
            </div>
            <input id="track-upload" type="file" className="sr-only" accept=".mp3,audio/mpeg" onChange={handleFileChange} disabled={isUploading} />
        </label>
        {isUploading && <p className="text-sm text-center mt-2">Enviando música...</p>}

        <div className="space-y-2">
          {loading ? (<p>Carregando biblioteca...</p>) 
            : tracks.length > 0 ? (
            tracks.map(track => (
              <div key={track.id} className="p-3 rounded-lg flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div>
                  <p className="font-semibold">{track.title}</p>
                  <p className="text-sm text-gray-500">{track.artist}</p>
                </div>
                <div className="flex items-center gap-x-2">
                    <button onClick={() => loadTrack(track, 'A')} className="w-10 h-10 font-bold bg-blue-500 text-white rounded hover:bg-blue-600">A</button>
                    <button onClick={() => loadTrack(track, 'B')} className="w-10 h-10 font-bold bg-red-500 text-white rounded hover:bg-red-600">B</button>
                    <button onClick={(e) => handleDelete(track.id, e)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-500 hover:text-red-600">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-6">Sua biblioteca está vazia. Faça o upload de uma música para começar.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicPage;