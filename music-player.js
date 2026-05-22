const MUSIC_KEY = 'constantiaMusicLinks';

function getLinks() {
  try { return JSON.parse(localStorage.getItem(MUSIC_KEY) || '[]'); } catch { return []; }
}

function saveLinks(links) {
  try { localStorage.setItem(MUSIC_KEY, JSON.stringify(links)); } catch {}
}

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (host.includes('spotify.com'))         return 'spotify';
    if (host.includes('music.apple.com'))     return 'apple';
    if (host.includes('music.amazon.com') || host.includes('amazon.com/music')) return 'amazon';
    if (host.includes('music.youtube.com') || host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('soundcloud.com'))      return 'soundcloud';
    if (host.includes('tidal.com'))           return 'tidal';
    if (host.includes('deezer.com'))          return 'deezer';
  } catch {}
  return null;
}

const PLATFORM_LABELS = {
  spotify: 'Spotify', apple: 'Apple Music', amazon: 'Amazon Music',
  youtube: 'YouTube', soundcloud: 'SoundCloud', tidal: 'Tidal', deezer: 'Deezer',
};

function platformLabel(p) { return PLATFORM_LABELS[p] || 'Music'; }

function getEmbedUrl(url, platform) {
  try {
    const u = new URL(url);
    switch (platform) {
      case 'spotify': {
        const path = u.pathname; // /playlist/ID, /track/ID, /album/ID, etc.
        return `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`;
      }
      case 'youtube': {
        const list = u.searchParams.get('list');
        if (list) return `https://www.youtube.com/embed/videoseries?list=${list}`;
        const id = u.hostname.includes('youtu.be')
          ? u.pathname.slice(1)
          : (u.searchParams.get('v') || u.pathname.split('/').pop());
        return `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
      case 'soundcloud':
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%239b30ff&auto_play=true&show_artwork=true&visual=true`;
      case 'apple': {
        const path = u.pathname.replace(/^\/[a-z]{2}\//, '/us/');
        return `https://embed.music.apple.com${path}`;
      }
      case 'deezer': {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2)
          return `https://widget.deezer.com/widget/dark/${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        return null;
      }
      case 'tidal': {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2)
          return `https://embed.tidal.com/${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        return null;
      }
      default:
        return null;
    }
  } catch { return null; }
}

function getEmbedHeight(platform) {
  if (platform === 'spotify')    return '152';
  if (platform === 'soundcloud') return '200';
  if (platform === 'apple')      return '175';
  return '200';
}

export function initMusicWidget(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let activeIndex = null;

  function getActive() {
    const links = getLinks();
    if (!links.length) return null;
    if (activeIndex !== null && links[activeIndex]) return links[activeIndex];
    return links[0];
  }

  function render() {
    const links = getLinks();
    const active = getActive();
    const embedUrl = active ? getEmbedUrl(active.url, active.platform) : null;

    let playerHtml = '';
    if (active && embedUrl) {
      playerHtml = `<div class="music-embed-wrap">
        <iframe src="${embedUrl}" height="${getEmbedHeight(active.platform)}"
          frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy" allowfullscreen></iframe>
      </div>`;
    } else if (active) {
      playerHtml = `<a class="music-open-link" href="${active.url}" target="_blank" rel="noopener">
        Open in ${platformLabel(active.platform)} ↗
      </a>`;
    }

    container.innerHTML = `
      <div class="music-widget">
        <div class="music-header">
          <span class="music-title">♪ Music</span>
          <div class="music-actions">
            ${links.length > 1 ? `<button class="music-btn music-shuffle" title="Shuffle">⇄ Shuffle</button>` : ''}
          </div>
        </div>

        ${playerHtml}

        <div class="music-add-row">
          <input class="music-url-input" type="url"
            placeholder="Paste Spotify, YouTube, Apple Music, SoundCloud… link" />
          <button class="music-btn music-add-btn">Add</button>
        </div>

        ${links.length > 1 ? `<ul class="music-list">${links.map((l, i) => `
          <li class="music-list-item${active === l ? ' music-active' : ''}" data-index="${i}">
            <span class="music-badge">${platformLabel(l.platform)}</span>
            <span class="music-link-name">${l.label}</span>
            <button class="music-remove" data-index="${i}" title="Remove">×</button>
          </li>`).join('')}
        </ul>` : ''}
      </div>`;

    // Add link
    container.querySelector('.music-add-btn').addEventListener('click', () => {
      const input = container.querySelector('.music-url-input');
      const url = input.value.trim();
      if (!url) return;
      const platform = detectPlatform(url);
      if (!platform) {
        alert('Unrecognized platform. Paste a link from Spotify, YouTube, Apple Music, SoundCloud, Deezer, Tidal, or Amazon Music.');
        return;
      }
      const links = getLinks();
      const label = `${platformLabel(platform)} #${links.length + 1}`;
      links.push({ url, platform, label });
      saveLinks(links);
      activeIndex = links.length - 1;
      render();
    });

    // Shuffle
    container.querySelector('.music-shuffle')?.addEventListener('click', () => {
      const links = getLinks();
      if (links.length < 2) return;
      const cur = activeIndex ?? 0;
      let idx;
      do { idx = Math.floor(Math.random() * links.length); } while (idx === cur);
      activeIndex = idx;
      render();
    });

    // Switch track
    container.querySelectorAll('.music-list-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.matches('.music-remove')) return;
        activeIndex = parseInt(item.dataset.index);
        render();
      });
    });

    // Remove link
    container.querySelectorAll('.music-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.index);
        const links = getLinks();
        links.splice(i, 1);
        saveLinks(links);
        activeIndex = links.length ? 0 : null;
        render();
      });
    });
  }

  render();
}
