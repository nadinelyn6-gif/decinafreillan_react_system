async function enhance(pcm) {
  const context = new OfflineAudioContext(1, pcm.length, 16000);
  const buffer = context.createBuffer(1, pcm.length, 16000);
  buffer.copyToChannel(pcm, 0);

  const source = context.createBufferSource();
  source.buffer = buffer;

  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80;
  highpass.Q.value = 0.7;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -32;
  compressor.knee.value = 24;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;

  source.connect(highpass);
  highpass.connect(compressor);
  compressor.connect(context.destination);
  source.start();

  return new Float32Array((await context.startRendering()).getChannelData(0));
}

/**
 * Decode any audio/video source into 16 kHz mono PCM,
 * optionally enhance the speech and normalise the level.
 */
export async function prepareAudio(src, shouldEnhance) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass({ sampleRate: 16000 });
  let buffer;
  try {
    buffer = await context.decodeAudioData(await src.arrayBuffer());
  } finally {
    context.close().catch(() => {});
  }

  const channels = buffer.numberOfChannels;
  let pcm = new Float32Array(buffer.getChannelData(0));

  if (channels > 1) {
    for (let channel = 1; channel < channels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < pcm.length; i += 1) pcm[i] += data[i];
    }
    for (let i = 0; i < pcm.length; i += 1) pcm[i] /= channels;
  }

  if (shouldEnhance) {
    try {
      pcm = await enhance(pcm);
    } catch {
      /* enhancement is best-effort */
    }
  }

  let peak = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const value = Math.abs(pcm[i]);
    if (value > peak) peak = value;
  }

  if (peak < 0.0005) {
    throw new Error('This file seems to be silent, so there is nothing to transcribe.');
  }

  if (peak < 0.9) {
    const gain = Math.min(0.95 / peak, 12);
    for (let i = 0; i < pcm.length; i += 1) pcm[i] *= gain;
  }

  return { pcm, duration: buffer.duration };
}
