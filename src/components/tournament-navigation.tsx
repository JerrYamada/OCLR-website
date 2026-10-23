"use client";

import { useAppTranslations } from "@/i18n/shared";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { publicTournamentSection } from "@/lib/public-navigation";
import {
  editionAppearancePreviewCookie,
  editionAppearancePreviewParam,
  readEditionAppearance,
  type EditionAppearance,
} from "@/lib/edition-appearance";

function Navigation({
  slug,
  liveDraft,
  mobileMenu = false,
}: {
  slug: string;
  liveDraft: boolean;
  mobileMenu?: boolean;
}) {
  const tr = useAppTranslations();

  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const base = `/tournaments/${slug}`;
  const links = [
    ["", "Overview"],
    ["schedule", "Schedule"],
    ["mappools", "Mappools"],
    ["teams", "Teams"],
    ["rules", "Rules"],
    ["results", "Results"],
    ["bracket", "Bracket"],
    ["players", "Players"],
    ...(liveDraft ? [["draft", "Live draft"]] : []),
  ];
  const active = publicTournamentSection(pathname, base);
  return (
    <div
      className="tournament-navigation"
      data-open={open || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      {mobileMenu && (
        <button
          ref={trigger}
          type="button"
          className="secondary tournament-menu"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {tr("Tournament menu ")}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      )}
      <nav id={id} aria-label={tr("Tournament navigation")}>
        {links.map(([section, label]) => (
          <Link
            key={section}
            href={`${base}${section ? `/${section}` : ""}`}
            aria-current={active === section ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {tr(label)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
export function TournamentNavigation(props: {
  slug: string;
  liveDraft: boolean;
  mobileMenu?: boolean;
}) {
  const path = usePathname();
  return <Navigation key={path} {...props} />;
}

/** Private captain tools and OBS retain the existing dark workspace. */
export function TournamentShell({
  slug,
  name,
  liveDraft,
  appearance = "default",
  appearancePreview,
  children,
}: {
  slug: string;
  name: string;
  liveDraft: boolean;
  appearance?: EditionAppearance;
  appearancePreview?: EditionAppearance;
  children: ReactNode;
}) {
  const tr = useAppTranslations();

  const path = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const requestedPreview = readEditionAppearance(
    search.get(editionAppearancePreviewParam),
  );
  const [preview, setPreview] = useState(requestedPreview ?? appearancePreview);
  const activePreview = requestedPreview ?? preview;
  const base = `/tournaments/${slug}`;
  const privateView =
    (path === `${base}/draft` && search.get("presenter") === "1") ||
    path === `${base}/team` ||
    path.startsWith(`${base}/draft/captain`) ||
    path.includes("/draft/overlay");
  useEffect(() => {
    if (!requestedPreview || privateView) return;
    document.cookie = `${editionAppearancePreviewCookie}=${slug}:${requestedPreview}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [requestedPreview, slug, privateView]);
  if (privateView)
    return (
      <div className="container page workspace tournament-workspace">
        <aside className="sidebar">
          <Link href="/tournaments" className="eyebrow">
            {tr("Tournaments")}
          </Link>
          <h2>{name}</h2>
          <TournamentNavigation slug={slug} liveDraft={liveDraft} />
        </aside>
        <div className="workspace-main">{children}</div>
      </div>
    );
  return (
    <div
      className="public-tournament"
      data-edition-theme={activePreview ?? appearance}
    >
      {activePreview && (
        <div className="notice edition-appearance-preview" role="status">
          <span>
            {tr("Appearance preview: {value0}", {
              value0: tr(
                activePreview === "cute-pastel"
                  ? "Cute pastel"
                  : "Website default",
              ),
            })}
            {" · "}
            {tr("Tournament settings and data are unchanged.")}
          </span>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              document.cookie = `${editionAppearancePreviewCookie}=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
              setPreview(undefined);
              const query = new URLSearchParams(search.toString());
              query.delete(editionAppearancePreviewParam);
              router.replace(`${path}${query.size ? `?${query}` : ""}`);
              router.refresh();
            }}
          >
            {tr("Exit appearance preview")}
          </button>
        </div>
      )}
      <div className="event-context">
        <div className="event-identity">
          <Link href="/tournaments" className="context-link">
            {tr("Tournaments")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={base} className="context-link">
            {name}
          </Link>
        </div>
        <TournamentNavigation slug={slug} liveDraft={liveDraft} mobileMenu />
      </div>
      <div className="event-content">{children}</div>
    </div>
  );
}
