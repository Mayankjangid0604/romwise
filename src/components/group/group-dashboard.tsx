"use client";

import { useState } from "react";
import { generateShareLink, revokeShareLink } from "@/app/actions/share";
import { removeGroupMember } from "@/app/actions/group";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Link2, Trash2, Users, Eye, Edit3, Sparkles } from "lucide-react";
import { TripRole } from "@/lib/security";
import { getGroupAlignment } from "@/app/actions/alignment";

type User = {
  id: string;
  name: string | null;
  email: string | null;
};

type Member = {
  id: string;
  userId: string;
  tripId: string;
  role: string;
  joinedAt: Date;
  user: User;
};

interface GroupDashboardProps {
  tripId: string;
  role: TripRole;
  creator: User;
  members: Member[];
  activeShares: { id: string; role: string; token: string; }[];
}

export function GroupDashboard({ tripId, role, creator, members, activeShares }: GroupDashboardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<{ harmonyScore: number; coreTension: string; compromiseSuggestion: string; } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const allParticipants = [
    { ...creator, role: "creator" },
    ...members.filter(m => m.userId !== creator.id).map(m => ({ ...m.user, role: m.role, memberId: m.id }))
  ];

  const handleGenerateLink = async (linkRole: TripRole) => {
    setIsGenerating(true);
    try {
      const share = await generateShareLink(tripId, linkRole);
      const url = `${window.location.origin}/trips/join/${share.token}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(linkRole);
      setTimeout(() => setCopiedLink(null), 3000);
    } catch (e) {
      console.error("Failed to generate link", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeLink = async (linkRole: TripRole) => {
    if (confirm(`Are you sure you want to revoke the ${linkRole} link? Existing links will stop working immediately.`)) {
      await revokeShareLink(tripId, linkRole);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      await removeGroupMember(tripId, userId);
    }
  };

  const handleAnalyzeAlignment = async () => {
    setIsAnalyzing(true);
    try {
      const result = await getGroupAlignment(tripId);
      setAlignment(result);
    } catch (e) {
      console.error(e);
      alert("Failed to analyze alignment.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Group Alignment Section */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100 flex flex-col p-5">
        <CardTitle className="text-xl flex items-center gap-2 text-indigo-900 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          AI Group Alignment
        </CardTitle>
        <div>
          {!alignment ? (
            <div className="text-center py-6">
              <p className="text-indigo-700/80 mb-4">
                Let Trip Brain analyze everyone&apos;s preferences to find common ground and suggest compromises.
              </p>
              <Button onClick={handleAnalyzeAlignment} disabled={isAnalyzing} className="bg-indigo-600 hover:bg-indigo-700">
                {isAnalyzing ? "Analyzing..." : "Analyze Alignment"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Harmony Score</p>
                  <p className="text-3xl font-bold text-indigo-600">{alignment.harmonyScore}/100</p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-indigo-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-indigo-500">
                    {alignment.harmonyScore >= 80 ? "🎯" : alignment.harmonyScore >= 50 ? "⚖️" : "⚔️"}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-white rounded-xl border border-red-100 shadow-sm">
                  <h4 className="font-semibold text-red-700 mb-1">Core Tension</h4>
                  <p className="text-sm text-red-900/80">{alignment.coreTension}</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                  <h4 className="font-semibold text-emerald-700 mb-1">Compromise Suggestion</h4>
                  <p className="text-sm text-emerald-900/80">{alignment.compromiseSuggestion}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setAlignment(null)} className="w-full mt-2">
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Share Links Section (Creator Only) */}
      {role === "creator" && (
        <Card className="flex flex-col p-5">
          <CardTitle className="text-xl flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-indigo-500" />
            Invite People
          </CardTitle>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/30 rounded-xl border gap-4">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-500" /> Member Link
                </h3>
                <p className="text-sm text-muted-foreground">Can vote, comment, and add preferences.</p>
              </div>
              <div className="flex gap-2">
                {activeShares.some(s => s.role === "member") && (
                  <Button variant="secondary" size="sm" onClick={() => handleRevokeLink("member")}>
                    Revoke
                  </Button>
                )}
                <Button size="sm" disabled={isGenerating} onClick={() => handleGenerateLink("member")}>
                  {copiedLink === "member" ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/30 rounded-xl border gap-4">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" /> Viewer Link
                </h3>
                <p className="text-sm text-muted-foreground">Can only view the itinerary.</p>
              </div>
              <div className="flex gap-2">
                {activeShares.some(s => s.role === "viewer") && (
                  <Button variant="secondary" size="sm" onClick={() => handleRevokeLink("viewer")}>
                    Revoke
                  </Button>
                )}
                <Button size="sm" disabled={isGenerating} onClick={() => handleGenerateLink("viewer")}>
                  {copiedLink === "viewer" ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Members List */}
      <Card className="flex flex-col p-5">
        <CardTitle className="text-xl flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-500" />
          Trip Members
        </CardTitle>
        <div>
          <ul className="divide-y">
            {allParticipants.map((p) => (
              <li key={p.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                    {p.name?.charAt(0).toUpperCase() || p.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{p.name || "Unknown"} <span className="text-muted-foreground text-sm font-normal">({p.email})</span></p>
                    <p className="text-sm text-muted-foreground capitalize">{p.role}</p>
                  </div>
                </div>
                {role === "creator" && p.role !== "creator" && (
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(p.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
