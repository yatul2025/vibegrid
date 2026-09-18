/**
 * client/src/components/group-settings/views/MediaFilesView.jsx
 * =============================================================
 * Screen 7: Media & Files (Photos, Videos, Files, Links)
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

export default function MediaFilesView({ mediaData = {} }) {
  const [activeTab, setActiveTab] = useState('photos'); // 'photos', 'videos', 'files', 'links'

  const photos = Array.isArray(mediaData.photos) ? mediaData.photos : [];
  const videos = Array.isArray(mediaData.videos) ? mediaData.videos : [];
  const files = Array.isArray(mediaData.files) ? mediaData.files : [];
  const links = Array.isArray(mediaData.links) ? mediaData.links : [];

  const getFileIcon = (fileName = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return {
        icon: <FileSpreadsheet size={18} />,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/15',
        borderColor: 'border-emerald-500/30'
      };
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return {
        icon: <FileArchive size={18} />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/15',
        borderColor: 'border-amber-500/30'
      };
    }
    return {
      icon: <FileText size={18} />,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/15',
      borderColor: 'border-rose-500/30'
    };
  };

  const renderEmptyState = (label, icon) => (
    <div className="py-12 px-4 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-500">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">No {label} shared yet</p>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
          Shared {label.toLowerCase()} in this group will appear here.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">
      {/* Category Pill Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10">
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
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      {activeTab === 'photos' && (
        photos.length === 0 ? (
          renderEmptyState('Photos', <ImageIcon size={22} />)
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {photos.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/40 transition-all group relative block"
              >
                <img
                  src={item.url}
                  alt="Shared media"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </a>
            ))}
          </div>
        )
      )}

      {activeTab === 'videos' && (
        videos.length === 0 ? (
          renderEmptyState('Videos', <Video size={22} />)
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {videos.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-video rounded-xl bg-zinc-900 border border-white/10 flex flex-col items-center justify-center text-zinc-400 gap-1.5 p-4 hover:border-cyan-500/40 transition-all cursor-pointer"
              >
                <Video size={24} className="text-cyan-400" />
                <span className="text-[11px] truncate max-w-[120px]">
                  {item.url?.split('/').pop() || 'Video'}
                </span>
              </a>
            ))}
          </div>
        )
      )}

      {activeTab === 'files' && (
        files.length === 0 ? (
          renderEmptyState('Files', <FileText size={22} />)
        ) : (
          <div className="space-y-2">
            {files.map((file) => {
              const style = getFileIcon(file.name);
              return (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${style.bgColor} ${style.color} border ${style.borderColor} flex items-center justify-center shrink-0`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {file.name || 'Document'}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {file.size || 'File'} • {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Shared'}
                      </p>
                    </div>
                  </div>

                  <Download size={16} className="text-zinc-500 group-hover:text-white transition-all shrink-0" />
                </a>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'links' && (
        links.length === 0 ? (
          renderEmptyState('Links', <Link2 size={22} />)
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                    <Link2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{link.title || link.url}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{link.url}</p>
                  </div>
                </div>
                <ExternalLink size={14} className="text-zinc-500 group-hover:text-cyan-400 shrink-0" />
              </a>
            ))}
          </div>
        )
      )}

      {/* Recent Files Section */}
      {activeTab !== 'files' && files.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Recent Files
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
            >
              View All &gt;
            </button>
          </div>

          <div className="space-y-2">
            {files.slice(0, 3).map((f) => {
              const style = getFileIcon(f.name);
              return (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${style.bgColor} ${style.color} border ${style.borderColor} flex items-center justify-center shrink-0`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {f.name || 'Document'}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {f.size || 'File'} • {f.created_at ? new Date(f.created_at).toLocaleDateString() : 'Shared'}
                      </p>
                    </div>
                  </div>

                  <Download size={16} className="text-zinc-500 group-hover:text-white transition-all shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
