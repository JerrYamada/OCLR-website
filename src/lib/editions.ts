import { eligibilityLimitsSchema } from "./eligibility-model";
import { z } from "zod";
const instant = z.iso.datetime({ offset: true });
const questionFields = {
  id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(200),
  required: z.boolean(),
};
export const questionSchema = z.union([
  z
    .object({
      ...questionFields,
      // Existing stored questions have no discriminator and remain text questions.
      type: z.literal("text").default("text"),
      maxLength: z.number().int().min(1).max(2000).default(500),
    })
    .strict(),
  z
    .object({
      ...questionFields,
      type: z.literal("single_choice"),
      options: z
        .array(
          z
            .object({
              id: questionFields.id,
              label: z.string().trim().min(1).max(200),
            })
            .strict(),
        )
        .min(2)
        .max(20),
    })
    .strict()
    .superRefine((question, context) => {
      for (const field of ["id", "label"] as const) {
        const seen = new Set<string>();
        question.options.forEach((option, index) => {
          const value = option[field];
          if (seen.has(value))
            context.addIssue({
              code: "custom",
              path: ["options", index, field],
              message: "Options must have distinct IDs and labels.",
            });
          seen.add(value);
        });
      }
    }),
]);
export type ApplicationQuestion = z.output<typeof questionSchema>;
export const editionSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    name: z.string().trim().min(1).max(100),
    season: z.string().trim().min(1).max(40).nullable().default(null),
    branding: z
      .object({
        logo: z.enum(["/oclr-s11-square-logo.webp"]).nullable(),
        background: z.enum(["/oclr-s11-website-background.webp"]).nullable(),
        keyVisual: z.enum(["/oclr-s11-key-visual.webp"]).nullable(),
        theme: z.enum(["default", "cute-pastel"]).optional(),
      })
      .strict()
      .default({ logo: null, background: null, keyVisual: null }),
    published: z.boolean(),
    status: z.enum(["upcoming", "live", "completed"]),
    summary: z.string().trim().max(2000),
    timeZone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((value) => {
        if (!/^[A-Za-z][A-Za-z0-9_+/-]*$/.test(value)) return false;
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Use an IANA time zone"),
    rules: z
      .object({
        version: z.string().trim().min(1).max(80),
        sections: z
          .array(
            z
              .object({
                heading: z.string().trim().min(1).max(200),
                body: z.string().trim().min(1).max(20000),
              })
              .strict(),
          )
          .min(1)
          .max(32),
      })
      .strict()
      .nullable(),
    automaticEligibility: eligibilityLimitsSchema.nullable().optional(),
    eligibility: z.string().trim().min(1).max(4000).nullable(),
    registration: z
      .object({
        enabled: z.boolean().default(true),
        opensAt: instant,
        closesAt: instant,
        withdrawUntil: instant.nullable(),
        questions: z.array(questionSchema).max(16).default([]),
      })
      .strict()
      .refine(
        (v) => Date.parse(v.opensAt) < Date.parse(v.closesAt),
        "Registration must close after it opens",
      )
      .refine(
        (v) =>
          new Set(v.questions.map((q) => q.id)).size === v.questions.length,
        "Question IDs must be unique",
      )
      .refine(
        (v) =>
          !v.withdrawUntil ||
          Date.parse(v.withdrawUntil) >= Date.parse(v.opensAt),
        "Withdrawal deadline must not precede opening",
      )
      .nullable(),
    schedule: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(200),
            at: instant.nullable(),
          })
          .strict(),
      )
      .max(64),
  })
  .strict()
  .refine((edition) => !edition.published || Boolean(edition.summary), {
    path: ["summary"],
    message: "Add a public summary before publishing.",
  });
/** Omit only the known bootstrap copy; never rewrite stored/approved content. */
export function publicEditionSummary(summary: string) {
  const normalized = summary.trim().replace(/\s+/g, " ");
  return !normalized ||
    [
      "Tournament information is awaiting organizer approval.",
      "osu! Chinese League Rookie — Season 11. Tournament information is awaiting organizer approval.",
    ].includes(normalized)
    ? null
    : summary.trim();
}
export function suggestEditionSlug(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "");
  return slug === "new" ? "new-tournament" : slug;
}
export type Edition = z.output<typeof editionSchema>;
export type EditionConfiguration = Omit<z.output<typeof editionSchema>, "slug">;
export const editionsSchema = z
  .array(editionSchema)
  .refine(
    (v) => new Set(v.map((e) => e.slug)).size === v.length,
    "Edition slugs must be unique",
  );
export function registrationBlockers(
  edition: Edition,
  privacyConfigured: boolean,
) {
  return [
    ...(!edition.published
      ? ["Publish the tournament before enabling registration."]
      : []),
    ...(!privacyConfigured
      ? ["Complete the server privacy configuration."]
      : []),
    ...(edition.status === "completed"
      ? ["Completed tournaments cannot accept registrations."]
      : []),
  ];
}
export function enrollmentState(
  edition: Edition,
  now = new Date(),
): "unannounced" | "upcoming" | "open" | "closed" | "paused" {
  if (!edition.published || !edition.registration) return "unannounced";
  if (
    edition.status === "completed" ||
    now.getTime() >= Date.parse(edition.registration.closesAt)
  )
    return "closed";
  if (edition.registration.enabled === false) return "paused";
  if (now.getTime() < Date.parse(edition.registration.opensAt))
    return "upcoming";
  return "open";
}
export function formatDate(
  value: string | Date | null,
  timeZone: string,
  locale = "en-GB",
): string {
  if (!value) return "To be announced";
  return `${new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(new Date(value))} (${timeZone})`;
}
