import { Modal } from "./ui";

// YouTube / Vimeo links become an embedded player; anything else is treated
// as a video file.
export function embedUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}?playsinline=1&rel=0`;
    if (host === "youtube.com") {
      const id = u.searchParams.get("v") || u.pathname.match(/\/(shorts|embed)\/([^/?]+)/)?.[2];
      if (id) return `https://www.youtube.com/embed/${id}?playsinline=1&rel=0`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}?playsinline=1`;
    }
  } catch {
    // not a URL we recognise
  }
  return null;
}

export default function VideoEmbed({ url, autoPlay = false }) {
  const embed = embedUrl(url);
  if (embed)
    return (
      <div className="video-frame">
        <iframe src={embed} title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      </div>
    );
  return (
    <div className="video-frame">
      <video src={url} controls playsInline autoPlay={autoPlay} preload="metadata" />
    </div>
  );
}

export function VideoModal({ title, url, cues, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <VideoEmbed url={url} autoPlay />
      {cues && <div className="small muted mt-12 pre">{cues}</div>}
    </Modal>
  );
}
