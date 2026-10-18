import React, { useState } from 'react';
import { useRouter } from '../router';
import { SurveyView } from './SurveyView';
import { useApp } from '../context/AppContext';
import {
  Users,
  Copy,
  Check,
  Edit3,
  Clock,
  CheckCircle2,
  Shield,
  Phone,
  AlertCircle,
  ExternalLink,
  Plus
} from 'lucide-react';

export const GroupWorkspaceView: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { navigate } = useRouter();
  const { group, members, currentMember } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const completedCount = members.filter((m) => m.isReady).length;
  const isAllReady = completedCount === members.length && members.length >= 2;

  const handleCopyLink = async (token: string) => {
    const origin = window.location.origin;
    // Uses the route path /join/:token
    const link = `${origin}/join/${token}`;
    try { await navigator.clipboard.writeText(link); } catch { setCopyError(`Copy this link: ${link}`); return; }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  if (editing) return <div><button className="underline mb-4" onClick={() => setEditing(null)}>← Back to group</button><SurveyView key={editing} targetMemberId={editing === currentMember?.id ? undefined : editing} isOrganizerEntering={editing !== currentMember?.id} onComplete={() => setEditing(null)} /></div>;
  return (
    <div className="space-y-6">{copyError && <p role="alert">{copyError}</p>}
      {/* Step 2 Header Banner */}
      <div className="p-6 bg-white border border-[#DED5CA] rounded-lg shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A55438] mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Your roommates</span>
            </div>
            <h1 className="font-serif text-5xl font-normal text-[#28221E]">
              {group?.name || 'Your Housing Group'}
            </h1>
            <p className="text-xs text-[#88796C] mt-1 font-mono">
              A home that works for all of you.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${
                isAllReady
                  ? 'bg-[#F2E8DC] text-[#794A31] border border-[#CDB8A6]'
                  : 'bg-[#FAF3E6] text-[#8C6218] border border-[#DED5CA]'
              }`}
            >
              {isAllReady ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              <span>
                {completedCount} of {members.length} ready
              </span>
            </span>
          </div>
        </div>

        {/* Recommended Action Box */}
        <div className="p-4 bg-[#F0E4D9] border border-[#DED5CA] rounded-md space-y-2 text-xs text-[#28221E]">
          <div className="font-semibold text-[#A55438] flex items-center gap-1.5">
            <span>Invite your roommates</span>
          </div>
          <p className="text-[#88796C] leading-relaxed">
            Send each roommate their link to add their preferences.
          </p>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="p-4 bg-white border border-[#DED5CA] rounded-lg flex items-start gap-3 text-xs text-[#88796C]">
        <Shield className="w-4 h-4 text-[#A55438] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-[#28221E] block mb-0.5 font-semibold">
            Private budgets
          </strong>
          Only you see your budget limit. Each roommate chooses whether to join phone alerts.
        </div>
      </div>

      {/* Member Readiness Cards Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-[#28221E] uppercase tracking-wider">
          Roommates ({members.length})
        </h2>

        <div className="space-y-3">
          {members.map((member, idx) => {
            const isMe = currentMember?.id === member.id;
            const isReady = member.isReady;

            return (
              <div
                key={member.id}
                className={`p-5 bg-white border rounded-lg shadow-2xs space-y-3 transition-colors ${
                  isReady ? 'border-[#CDB8A6]' : 'border-[#DED5CA]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base text-[#28221E]">
                        {member.displayName}
                      </span>
                      {member.isOrganizer && (
                        <span className="text-[10px] font-mono font-bold text-[#A55438] bg-[#F0E4D9] px-2 py-0.5 rounded">
                          Organizer
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[10px] font-mono font-bold text-[#794A31] bg-[#F2E8DC] px-2 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#88796C] mt-1 font-mono">
                      <span>{member.maskedPhone || 'No phone registered'}</span>
                      <span>·</span>
                      <span>
                        Alerts:{' '}
                        {member.phoneAlertsOptIn ? 'Opted In' : 'Web only'}
                      </span>
                      {member.provenance === 'organizer_entered' && (
                        <>
                          <span>·</span>
                          <span className="text-[#8C6218]">Added by organizer</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isReady ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F2E8DC] text-[#794A31] text-xs font-semibold rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF3E6] text-[#8C6218] text-xs font-semibold rounded">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Not ready yet</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions & Copy Links */}
                <div className="pt-3 border-t border-[#DED5CA] flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Copy Invite Link */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!member.inviteToken}
                      onClick={() => handleCopyLink(member.inviteToken)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F3EB] hover:bg-[#F0E4D9] border border-[#DED5CA] rounded font-medium text-[#28221E] transition-colors min-h-[44px]"
                      title="Copy single-use invite link"
                    >
                      {copiedToken === member.inviteToken ? (
                        <>
                          <Check className="w-4 h-4 text-[#794A31]" />
                          <span className="text-[#794A31] font-semibold">Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#A55438]" />
                          <span>{member.inviteToken ? 'Copy Private Invite Link' : 'Invitation claimed'}</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] font-mono text-[#88796C] hidden sm:inline">
                      {member.inviteToken ? `/join/${member.inviteToken.substring(0,12)}…` : ''}
                    </span>
                  </div>

                  {/* Survey Entry Actions */}
                  <div className="flex items-center gap-2">
                    {/* Take / Edit Survey for yourself */}
                    {isMe ? (
                      <button
                        onClick={() => setEditing(member.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A55438] hover:bg-[#86412C] text-white font-semibold rounded transition-colors min-h-[44px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isReady ? 'Edit my preferences' : 'Add my preferences'}</span>
                      </button>
                    ) : currentMember?.isOrganizer && (group?.isFixture || member.provenance !== 'self') ? (
                      /* Organizer-entered mode with explicit provenance */
                      <button
                        onClick={() => setEditing(member.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F7F3EB] border border-[#DED5CA] text-[#A55438] font-semibold rounded transition-colors min-h-[44px]"
                        title="Enter preferences together with explicit organizer provenance"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Enter preferences together (in-person)</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Step Guidance */}
      <div className="p-5 bg-white border border-[#DED5CA] rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-sm text-[#28221E]">
            {isAllReady
              ? 'All roommates ready! Real group matching active'
              : 'Waiting for all roommates to complete their surveys'}
          </h3>
          <p className="text-xs text-[#88796C] mt-0.5">
            Ready to see what fits?
          </p>
        </div>

        <button
          onClick={() => navigate(`/group/${groupId}/matches`)}
          className="px-5 py-2.5 bg-[#A55438] hover:bg-[#86412C] text-white text-xs font-semibold rounded shrink-0 min-h-[44px] transition-colors"
        >
          View Matches →
        </button>
      </div>
    </div>
  );
};
