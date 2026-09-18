/**
 * client/src/components/group-settings/views/MediaFilesView.jsx
 * =============================================================
 * Screen 7: Media & Files (Photos, Videos, Files, Links) — Unified VibeGrid Design
 */

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Video,
  FileText,
  Link2,
  ExternalLink,
  ChevronRight,
  FileSpreadsheet,
  FileArchive,
  Download
} from 'lucide-react';
import { MediaFilesSkeleton } from '../../common/Skeleton';

export default function MediaFilesView({ mediaData = {}, loading = false }) {
  const [activeTab, setActiveTab] = useState('photos'); // 'photos', 'videos', 'files', 'links'

  const photos = Array.isArray(mediaData.photos) ? mediaData.photos : [];
  const videos = Array.isArray(mediaData.videos) ? mediaData.videos : [];
  const files = Array.isArray(mediaData.files) ? mediaData.files : [];
  const links = Array.isArray(mediaData.links) ? mediaData.links : [];

  if (loading && photos.length === 0 && videos.length === 0 && files.length === 0 && links.length === 0) {
    return <MediaFilesSkeleton />;
  }

  const getFileIcon = (fileName = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return {
        icon: <FileSpreadsheet size={18} />,
        color: 'text-[var(--success)]',
        bgColor: 'bg-[rgba(16,185,129,0.12)]'
      };
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return {
        icon: <FileArchive size={18} />,
        color: 'text-[var(--warning)]',
        bgColor: 'bg-[rgba(245,158,11,0.12)]'
      };
    }
    return {
      icon: <FileText size={18} />,
      color: 'text-[var(--primary)]',
      bgColor: 'var(--primary-light)'
    };
  };

  const renderEmptyState = (label, icon) => (
    <div className="py-12 px-4 text-center space-y-2 vg-card-subtle">
      <div className="w-10 h-10 mx-auto rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]">
        {icon}
      </div>
      <p className="text-xs font-semibold text-[var(--text-primary)] m-0">No {label} shared yet</p>
      <p className="text-[11px] text-[var(--text-muted)] m-0">
        Shared {label.toLowerCase()} in this conversation will appear here.
      </p>
    </div>
  );

  return (
    <div className="space-y-4 text-left">
      {/* 1. Category Segmented Tab Bar */}
      <div className="vg-tab-bar">
        {[
          { id: 'photos', label: `Photos (${photos.length})` },
          { id: 'videos', label: `Videos (${videos.length})` },
          { id: 'files', label: `Files (${files.length})` },
          { id: 'links', label: `Links (${links.length})` }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`vg-tab-btn ${isActive ? 'is-active' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. Photos Tab */}
      {activeTab === 'photos' && (
        photos.length === 0 ? (
          renderEmptyState('Photos', <ImageIcon size={20} />)
        ) : (
          <div className="vg-media-grid">
            {photos.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="vg-media-item-thumb block"
              >
                <img
                  src={item.url}
                  alt="Shared media"
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        )
      )}

      {/* 3. Videos Tab */}
      {activeTab === 'videos' && (
        videos.length === 0 ? (
          renderEmptyState('Videos', <Video size={20} />)
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {videos.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-video rounded-xl bg-[var(--bg-hover)] border border-[var(--border-color)] flex flex-col items-center justify-center text-[var(--text-secondary)] gap-1 p-3 hover:border-[var(--primary)] transition-all"
              >
                <Video size={22} className="text-[var(--primary)]" />
                <span className="text-[11px] truncate max-w-[120px] text-[var(--text-primary)]">
                  {item.url?.split('/').pop() || 'Video'}
                </span>
              </a>
            ))}
          </div>
        )
      )}

      {/* 4. Files Tab */}
      {activeTab === 'files' && (
        files.length === 0 ? (
          renderEmptyState('Files', <FileText size={20} />)
        ) : (
          <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
            {files.map((file) => {
              const style = getFileIcon(file.name);
              return (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="vg-file-row hover:bg-[var(--bg-card)] transition-colors text-inherit no-underline"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${style.bgColor} ${style.color} flex items-center justify-center shrink-0`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate m-0">
                        {file.name || 'Document'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] m-0">
                        {file.size || 'File'} • {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Shared'}
                      </p>
                    </div>
                  </div>

                  <Download size={15} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0" />
                </a>
              );
            })}
          </div>
        )
      )}

      {/* 5. Links Tab */}
      {activeTab === 'links' && (
        links.length === 0 ? (
          renderEmptyState('Links', <Link2 size={20} />)
        ) : (
          <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 hover:bg-[var(--bg-card)] transition-colors text-inherit no-underline"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                    <Link2 size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate m-0">{link.title || link.url}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate m-0">{link.url}</p>
                  </div>
                </div>
                <ExternalLink size={14} className="text-[var(--text-muted)] shrink-0" />
              </a>
            ))}
          </div>
        )
      )}
    </div>
  );
}
