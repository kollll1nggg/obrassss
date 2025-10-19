import React, { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { MusicTrack } from '../types';
import { PlayCircleIcon, PauseCircleIcon, StopCircleIcon } from './icons/Icons';
import RotaryKnob from './RotaryKnob';

interface DJPlayerProps {
  track: MusicTrack;
  onStop: () => void;
  deckId: 'A' | 'B';
  audioContext: AudioContext;
  destinationNode: AudioNode;
}

// Helper function to create a synthetic reverb impulse response
async function createImpulseResponse(audioContext: AudioContext): Promise<AudioBuffer> {
    const sampleRate = audioContext.sampleRate;
    const duration = 2; // 2 seconds reverb
    const decay = 5;
    const length = sampleRate * duration;
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = length - i;
        left[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    }
    return impulse;
}


const DJPlayer: React.FC<DJPlayerProps> = ({ track, onStop, deckId, audioContext, destinationNode }) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [masterTempo, setMasterTempo] = useState(false);
  
  // Effects states
  const [lowGain, setLowGain] = useState(0);
  const [midGain, setMidGain] = useState(0);
  const [highGain, setHighGain] = useState(0);
  const [hplpFilter, setHplpFilter] = useState(0); 
  const [reverb, setReverb] = useState(0);
  const [delay, setDelay] = useState(0);
  const [cuePoint, setCuePoint] = useState(0);

  // Loop states
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);

  // Audio Node refs
  const audioGraphInitialized = useRef(false);
  const lowFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const highFilterRef = useRef<BiquadFilterNode | null>(null);
  const hplpFilterRef = useRef<BiquadFilterNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainReverbRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const wetGainDelayRef = useRef<GainNode | null>(null);


  const jogWheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const rotationRef = useRef(0);
  const wasPlayingBeforeDrag = useRef(false);

  useEffect(() => {
    if (!waveformRef.current) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: deckId === 'A' ? '#3b82f6' : '#ef4444',
      progressColor: deckId === 'A' ? '#60a5fa' : '#f87171',
      height: 60,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      mediaControls: false,
    });
    wavesurfer.current = ws;
    
    ws.on('ready', async () => {
      if (!audioGraphInitialized.current) {
        try {
          const mediaElement = ws.getMediaElement();
          if (!mediaElement) throw new Error("Could not get MediaElement.");
          
          const source = audioContext.createMediaElementSource(mediaElement);

          // Create all nodes
          const lowFilter = audioContext.createBiquadFilter();
          const midFilter = audioContext.createBiquadFilter();
          const highFilter = audioContext.createBiquadFilter();
          const hplpFilterNode = audioContext.createBiquadFilter();
          const dryGain = audioContext.createGain();
          const wetGainReverb = audioContext.createGain();
          const wetGainDelay = audioContext.createGain();
          const convolver = audioContext.createConvolver();
          const delayNode = audioContext.createDelay(5.0);
          const delayFeedback = audioContext.createGain();
          
          // Store refs
          lowFilterRef.current = lowFilter;
          midFilterRef.current = midFilter;
          highFilterRef.current = highFilter;
          hplpFilterRef.current = hplpFilterNode;
          dryGainRef.current = dryGain;
          wetGainReverbRef.current = wetGainReverb;
          convolverRef.current = convolver;
          delayNodeRef.current = delayNode;
          delayFeedbackRef.current = delayFeedback;
          wetGainDelayRef.current = wetGainDelay;

          // Configure nodes
          lowFilter.type = 'lowshelf'; lowFilter.frequency.value = 320;
          midFilter.type = 'peaking'; midFilter.frequency.value = 1000; midFilter.Q.value = 0.5;
          highFilter.type = 'highshelf'; highFilter.frequency.value = 3200;
          hplpFilterNode.type = 'lowpass'; hplpFilterNode.frequency.value = audioContext.sampleRate / 2; hplpFilterNode.Q.value = 1;
          dryGain.gain.value = 1;
          wetGainReverb.gain.value = 0;
          wetGainDelay.gain.value = 0;
          delayNode.delayTime.value = 0.5; // Example delay time
          delayFeedback.gain.value = 0; // Controlled by knob
          convolver.buffer = await createImpulseResponse(audioContext);

          // Connect audio graph
          // source -> EQ -> HP/LP -> Split to dry/wet
          source.connect(lowFilter);
          lowFilter.connect(midFilter);
          midFilter.connect(highFilter);
          highFilter.connect(hplpFilterNode);
          
          // Main dry signal path
          hplpFilterNode.connect(dryGain);
          
          // Reverb wet path
          hplpFilterNode.connect(convolver);
          convolver.connect(wetGainReverb);
          
          // Delay wet path (with feedback loop)
          hplpFilterNode.connect(delayNode);
          delayNode.connect(delayFeedback);
          delayFeedback.connect(delayNode); // Feedback loop
          delayNode.connect(wetGainDelay);

          // Mix everything to the deck's destination node
          dryGain.connect(destinationNode);
          wetGainReverb.connect(destinationNode);
          wetGainDelay.connect(destinationNode);

          audioGraphInitialized.current = true;
        } catch (error) { console.error(`Error on Deck ${deckId}:`, error); }
      }
      ws.play();
    });

    ws.on('error', (err) => { console.error(`WaveSurfer error on Deck ${deckId}:`, err); });
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => { onStop(); });
    ws.on('timeupdate', (currentTime) => {
      // Loop logic
      if(isLooping && loopStart !== null && loopEnd !== null && currentTime >= loopEnd) {
        ws.setTime(loopStart);
      }
      // Jog wheel rotation
      if (!isDragging) {
          const duration = ws.getDuration();
          if (duration > 0) {
            rotationRef.current = (currentTime / duration) * 360 * 2;
            if (jogWheelRef.current) {
                jogWheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
            }
          }
      }
    });

    ws.load(track.url);

    return () => { ws.destroy(); };
  }, [track.url, deckId, audioContext, destinationNode, onStop]);


  // Effect controllers
  useEffect(() => { if (lowFilterRef.current) lowFilterRef.current.gain.value = lowGain }, [lowGain]);
  useEffect(() => { if (midFilterRef.current) midFilterRef.current.gain.value = midGain }, [midGain]);
  useEffect(() => { if (highFilterRef.current) highFilterRef.current.gain.value = highGain }, [highGain]);
  
  useEffect(() => {
    const dryValue = 1 - Math.max(reverb, delay);
    if (dryGainRef.current) dryGainRef.current.gain.value = dryValue;
    if (wetGainReverbRef.current) wetGainReverbRef.current.gain.value = reverb;
    if (wetGainDelayRef.current && delayFeedbackRef.current) {
        wetGainDelayRef.current.gain.value = delay > 0 ? 1 : 0; // Wet signal is full when delay is on
        delayFeedbackRef.current.gain.value = delay; // Feedback is controlled by knob
    }
  }, [reverb, delay]);

  useEffect(() => {
    if (!hplpFilterRef.current?.context) return;
    const { current: filter } = hplpFilterRef; const { context } = filter;
    const maxFreq = context.sampleRate / 2; const minFreq = 40;
    if (hplpFilter === 0) { filter.frequency.value = maxFreq; filter.Q.value = 1; }
    else if (hplpFilter < 0) { filter.type = 'lowpass'; const freq = Math.exp((1 + hplpFilter) * Math.log(maxFreq / minFreq)) * minFreq; filter.frequency.value = freq; filter.Q.value = 1 + Math.abs(hplpFilter) * 4; }
    else { filter.type = 'highpass'; const freq = Math.exp(hplpFilter * Math.log(maxFreq / minFreq)) * minFreq; filter.frequency.value = freq; filter.Q.value = 1 + hplpFilter * 4; }
  }, [hplpFilter]);

  
  const handleTogglePlay = () => { wavesurfer.current?.playPause(); };
  const handleStop = () => { onStop(); }
  
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    setPlaybackRate(newRate);
    wavesurfer.current?.setPlaybackRate(newRate, masterTempo);
  }
  const resetRate = () => {
    setPlaybackRate(1);
    wavesurfer.current?.setPlaybackRate(1, masterTempo);
  }
  
  const handleSetCue = () => { if(wavesurfer.current) setCuePoint(wavesurfer.current.getCurrentTime()); };
  const handleGoToCue = () => {
      if(wavesurfer.current) {
        wavesurfer.current.setTime(cuePoint);
        wavesurfer.current.pause();
      }
  }

  // Loop handlers
  const handleLoopIn = () => { setLoopStart(wavesurfer.current?.getCurrentTime() ?? 0); setLoopEnd(null); setIsLooping(false); };
  const handleLoopOut = () => { if (loopStart !== null) { setLoopEnd(wavesurfer.current?.getCurrentTime() ?? 0); setIsLooping(true); } };
  const handleExitLoop = () => { setIsLooping(false); setLoopStart(null); setLoopEnd(null); };

  // Jog Wheel Handlers
  const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); wasPlayingBeforeDrag.current = wavesurfer.current?.isPlaying() || false; if (wasPlayingBeforeDrag.current) { wavesurfer.current?.pause(); } setIsDragging(true); document.body.style.cursor = 'grabbing'; };
  const handleMouseMove = useCallback((e: MouseEvent) => { if (!isDragging || !wavesurfer.current) return; const { movementX } = e; const ws = wavesurfer.current; const duration = ws.getDuration(); if(duration > 0) { ws.setTime(ws.getCurrentTime() + movementX * 0.01); rotationRef.current += movementX * 0.5; if(jogWheelRef.current) { jogWheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`; } } }, [isDragging]);
  const handleMouseUp = useCallback(() => { if (isDragging) { if (wasPlayingBeforeDrag.current) { wavesurfer.current?.play(); } setIsDragging(false); document.body.style.cursor = 'default'; } }, [isDragging]);
  useEffect(() => { if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); } else { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); } return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); }; }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="bg-gray-800 dark:bg-black text-white p-4 rounded-lg shadow-lg border border-gray-700 space-y-2">
      <div className="flex justify-between items-center">
        <span className={`font-bold text-lg ${deckId === 'A' ? 'text-blue-400' : 'text-red-400'}`}>DECK {deckId}</span>
        <div className="text-right">
          <h3 className="font-bold truncate text-base">{track.title}</h3>
          <p className="text-xs text-gray-400">{track.artist}</p>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row justify-center items-center gap-x-4">
        {/* EQ Knobs */}
        <div className="flex flex-row md:flex-col gap-4">
            <RotaryKnob label="HIGH" value={highGain} min={-40} max={40} onChange={setHighGain} onDoubleClick={() => setHighGain(0)} />
            <RotaryKnob label="MID" value={midGain} min={-40} max={40} onChange={setMidGain} onDoubleClick={() => setMidGain(0)} />
            <RotaryKnob label="LOW" value={lowGain} min={-40} max={40} onChange={setLowGain} onDoubleClick={() => setLowGain(0)} />
        </div>

        {/* Center Controls */}
        <div className="flex-grow flex flex-col items-center gap-y-2">
            <div ref={waveformRef} className="w-full h-[60px] my-2 bg-gray-700 rounded" />
            <div 
                ref={jogWheelRef}
                onMouseDown={handleMouseDown}
                className="w-40 h-40 bg-gray-700 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none shadow-lg"
            >
                <div className={`w-36 h-36 bg-black rounded-full border-4 ${deckId === 'A' ? 'border-blue-600' : 'border-red-600'} relative`}>
                    <div className={`absolute top-1 left-1/2 -ml-0.5 h-4 w-1 ${deckId === 'A' ? 'bg-blue-400' : 'bg-red-400'} rounded-full`}></div>
                </div>
            </div>
            {/* Loop controls */}
            <div className="flex items-center gap-x-2">
                <button onClick={handleLoopIn} className={`px-4 py-1 text-xs font-bold rounded ${loopStart !== null && loopEnd === null ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>IN</button>
                <button onClick={handleLoopOut} disabled={loopStart === null} className="px-4 py-1 text-xs font-bold bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">OUT</button>
                <button onClick={handleExitLoop} className="px-4 py-1 text-xs font-bold bg-gray-700 hover:bg-gray-600 rounded">EXIT</button>
            </div>
        </div>

        {/* Effects Knobs */}
        <div className="flex flex-row md:flex-col gap-4">
            <RotaryKnob label="FILTER" value={hplpFilter} min={-1} max={1} onChange={setHplpFilter} onDoubleClick={() => setHplpFilter(0)} />
            <RotaryKnob label="DELAY" value={delay} min={0} max={0.7} onChange={setDelay} onDoubleClick={() => setDelay(0)} />
            <RotaryKnob label="REVERB" value={reverb} min={0} max={1} onChange={setReverb} onDoubleClick={() => setReverb(0)} />
        </div>
      </div>
      
      <div className="flex items-center justify-center space-x-2 md:space-x-4 mt-2">
        <div className="flex items-center gap-x-1 md:gap-x-2">
            <button onClick={handleSetCue} className="px-3 py-2 text-xs font-bold bg-gray-700 hover:bg-gray-600 rounded">SET</button>
            <button onClick={handleGoToCue} className="px-3 py-2 text-xs font-bold bg-yellow-500 hover:bg-yellow-400 text-black rounded">CUE</button>
        </div>
        <button onClick={handleTogglePlay}>
          {isPlaying ? <PauseCircleIcon className="w-10 h-10 text-brand-500" /> : <PlayCircleIcon className="w-10 h-10 text-brand-500" />}
        </button>
        <button onClick={handleStop}>
            <StopCircleIcon className="w-10 h-10 text-gray-500 hover:text-gray-400" />
        </button>
         <div className="flex flex-col items-center">
            <span className="text-xs font-bold uppercase">Pitch</span>
            <input 
              type="range" 
              min="0.5" 
              max="2" 
              step="0.01" 
              value={playbackRate} 
              onChange={handleRateChange} 
              onDoubleClick={resetRate}
              className="w-20 md:w-24 h-1 accent-brand-500" 
            />
            <div className="flex items-center gap-x-2 mt-1">
                <button onClick={resetRate} className="text-[10px] p-1 bg-gray-700 rounded">RESET</button>
                <button onClick={() => setMasterTempo(!masterTempo)} className={`text-[10px] p-1 rounded ${masterTempo ? 'bg-brand-500 text-white' : 'bg-gray-700'}`}>MT</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DJPlayer;