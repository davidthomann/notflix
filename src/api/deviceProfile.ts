/**
 * Builds a Jellyfin DeviceProfile from what the current browser reports it can decode.
 * The server uses this to pick direct play or to produce a transcode the browser can handle.
 */

export type CanPlay = (mime: string) => boolean;

function browserCanPlay(): CanPlay {
  const video = document.createElement('video');
  return (mime) => {
    const native = video.canPlayType(mime);
    if (native === 'probably' || native === 'maybe') return true;
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mime);
  };
}

export function buildDeviceProfile(maxBitrate: number, canPlay: CanPlay = browserCanPlay()) {
  const videoCodecs = [
    canPlay('video/mp4; codecs="avc1.640029"') && 'h264',
    (canPlay('video/mp4; codecs="hvc1.1.6.L120.90"') || canPlay('video/mp4; codecs="hev1.1.6.L120.90"')) && 'hevc',
    canPlay('video/mp4; codecs="av01.0.08M.08"') && 'av1',
    canPlay('video/mp4; codecs="vp09.00.10.08"') && 'vp9',
  ].filter(Boolean) as string[];

  const audioCodecs = [
    canPlay('audio/mp4; codecs="mp4a.40.2"') && 'aac',
    canPlay('audio/mpeg') && 'mp3',
    canPlay('audio/mp4; codecs="opus"') && 'opus',
    canPlay('audio/mp4; codecs="flac"') && 'flac',
    canPlay('audio/mp4; codecs="ac-3"') && 'ac3',
    canPlay('audio/mp4; codecs="ec-3"') && 'eac3',
  ].filter(Boolean) as string[];

  const webmVideo = [canPlay('video/webm; codecs="vp8"') && 'vp8', canPlay('video/webm; codecs="vp9"') && 'vp9', canPlay('video/webm; codecs="av01.0.08M.08"') && 'av1'].filter(Boolean) as string[];
  const webmAudio = [canPlay('audio/webm; codecs="vorbis"') && 'vorbis', canPlay('audio/webm; codecs="opus"') && 'opus'].filter(Boolean) as string[];

  const directPlay: Record<string, unknown>[] = [
    { Container: 'mp4,m4v', Type: 'Video', VideoCodec: videoCodecs.join(','), AudioCodec: audioCodecs.join(',') },
  ];
  if (webmVideo.length) {
    directPlay.push({ Container: 'webm', Type: 'Video', VideoCodec: webmVideo.join(','), AudioCodec: webmAudio.join(',') });
  }
  if (canPlay('video/x-matroska; codecs="avc1.640029"')) {
    directPlay.push({ Container: 'mkv', Type: 'Video', VideoCodec: videoCodecs.join(','), AudioCodec: audioCodecs.join(',') });
  }

  // Stream copy works only for codecs that fit in the HLS fMP4 container and that the browser decodes.
  const hlsVideo = videoCodecs.filter((c) => c === 'h264' || c === 'hevc');
  const hlsAudio = audioCodecs.filter((c) => c === 'aac' || c === 'mp3' || c === 'ac3' || c === 'eac3');

  return {
    Name: 'jellyfin-frontend',
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    MusicStreamingTranscodingBitrate: 384000,
    DirectPlayProfiles: directPlay,
    TranscodingProfiles: [
      {
        Container: 'mp4',
        Type: 'Video',
        VideoCodec: (hlsVideo.length ? hlsVideo : ['h264']).join(','),
        AudioCodec: (hlsAudio.length ? hlsAudio : ['aac']).join(','),
        Protocol: 'hls',
        Context: 'Streaming',
        MaxAudioChannels: '6',
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
    ],
    ContainerProfiles: [],
    CodecProfiles: [],
    SubtitleProfiles: [
      // Text subtitles arrive as WebVTT sidecars; image formats must be burned in by the server.
      ...['vtt', 'srt', 'subrip', 'ass', 'ssa', 'sub', 'smi', 'ttml', 'mov_text'].map((Format) => ({ Format, Method: 'External' })),
      ...['pgssub', 'pgs', 'dvdsub', 'dvbsub', 'xsub', 'vobsub'].map((Format) => ({ Format, Method: 'Encode' })),
    ],
  };
}
