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

  const photos = mediaData.photos || [
    { id: 1, url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80' },
    { id: 2, url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=80' },
    { id: 3, url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&q=80' },
    { id: 4, url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&q=80' },
    { id: 5, url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=80' },
    { id: 6, url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=80' },
    { id: 7, url: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=300&q=80' },
    { id: 8, url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&q=80' }
  ];

  const recentFiles = [
    {
      id: 1,
      name: 'vibegrid-docs.pdf',
      size: '2.4 MB',
      time: '2d',
      type: 'pdf',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/15',
      borderColor: 'border-rose-500/30'
    },
    {
      id: 2,
      name: 'project-plan.xlsx',
      size: '1.1 MB',
      time: '3d',
      type: 'xlsx',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-500/30'
    },
    {
      id: 3,
      name: 'design-assets.zip',
      size: '8.7 MB',
      time: '5d',
      type: 'zip',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/30'
    }
  ];

  const links = [
    { id: 1, url: 'https://vibegrid.app/features', title: 'VibeGrid Feature Showcase', time: '1d' },
    { id: 2, url: 'https://github.com/yatul2025/vibegrid', title: 'Official GitHub Repository', time: '3d' },
    { id: 3, url: 'https://developer.mozilla.org', title: 'MDN Web Docs', time: '4d' }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">
      {/* Category Pill Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10">
        {[
          { id: 'photos', label: 'Photos' },
          { id: 'videos', label: 'Videos' },
          { id: 'files', label: 'Files' },
          { id: 'links', label: 'Links' }
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
        <div className="grid grid-cols-4 gap-2">
          {photos.map((item) => (
            <div
              key={item.id}
              className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/40 transition-all group relative cursor-pointer"
            >
              <img
                src={item.url}
                alt="Shared media"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((v) => (
            <div
              key={v}
              className="aspect-video rounded-xl bg-zinc-900 border border-white/10 flex flex-col items-center justify-center text-zinc-400 gap-1.5 p-4 hover:border-cyan-500/40 transition-all cursor-pointer"
            >
              <Video size={24} className="text-cyan-400" />
              <span className="text-[11px]">Video clip #{v}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'links' && (
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
                  <p className="text-xs font-semibold text-white truncate">{link.title}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{link.url}</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-zinc-500 group-hover:text-cyan-400 shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* Recent Files Section */}
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
          {recentFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl ${f.bgColor} ${f.color} border ${f.borderColor} flex items-center justify-center shrink-0`}>
                  {f.type === 'xlsx' ? (
                    <FileSpreadsheet size={18} />
                  ) : f.type === 'zip' ? (
                    <FileArchive size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {f.name}
                  </p>
                  <p className="text-[10px] text-zinc-400">{f.size} • {f.time}</p>
                </div>
              </div>

              <ChevronRight size={16} className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
