import { Palette, Ruler, Scissors, Users, type LucideIcon } from "lucide-react";
import type { OnboardingStep, Permission } from "../../types/auth.types";

export interface GuideStep {
  id: OnboardingStep;
  title: string;
  /** One line on why the step matters; shown in Settings and before they reach the page. */
  summary: string;
  /** What to do, shown once they are on the step's page. */
  tips: string[];
  /** The page the step happens on. */
  path: string;
  /** Where "Go there" takes them; defaults to `path`. */
  start?: string;
  startLabel: string;
  /** Pages that count as being "on" the step (defaults to `path`). */
  matches?: (pathname: string) => boolean;
  /** Steps with nothing to create (reviewing templates) are finished by tapping this. */
  confirmLabel?: string;
  /** Shown once the step is done. */
  doneMessage: string;
  icon: LucideIcon;
  /** Who can do this step; people without it never see it. */
  permission: Permission;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "templates",
    title: "Set up your measurement templates",
    summary: "Templates are the lists of measurements you take for each garment. Five are ready to start you off.",
    tips: [
      "Look through the ready-made templates: Shirt, Trousers, Gown, Senator and Suit.",
      "Tap the pencil on a template to rename it, add or remove measurements, or change their order.",
      "Tick Required on measurements you never want to skip.",
      "Sew something that isn't here? Tap New template, e.g. Agbada or Kaftan.",
    ],
    path: "/settings/measurements",
    startLabel: "Open templates",
    confirmLabel: "My templates are ready",
    doneMessage: "Templates are set up.",
    icon: Ruler,
    permission: "measurement.template.manage",
  },
  {
    id: "customers",
    title: "Add your first customer",
    summary: "Keep each customer's phone number, measurements and orders together in one place.",
    tips: [
      "Tap New customer, then enter their name and phone number. Everything else is optional.",
      "Tap Save. Their page opens next.",
      "On their page, tap Record under Measurements to measure them with one of your templates.",
    ],
    path: "/customers",
    start: "/customers?new=1",
    startLabel: "Add a customer",
    matches: (pathname) => pathname.startsWith("/customers"),
    doneMessage: "Customer saved.",
    icon: Users,
    permission: "customer.create",
  },
  {
    id: "order",
    title: "Create a practice order",
    summary: "Try an order from start to finish to see how it works. You can cancel it afterwards.",
    tips: [
      "Pick the customer you just added.",
      "Under the item, name the garment, then pick their saved measurements or record new ones.",
      "Enter a price and, if you like, a due date.",
      "Tap Create order. From the order you can record payments and move it through each stage.",
    ],
    path: "/orders/new",
    startLabel: "Start an order",
    doneMessage: "Order created.",
    icon: Scissors,
    permission: "order.create",
  },
  {
    id: "designs",
    title: "Add your first design",
    summary: "Build a catalogue of the styles you make, to show customers and attach to orders.",
    tips: [
      "Tap New design and add a photo of a style you make.",
      "Give it a name, a category and a price range.",
      "Turn on Show to customers to put it on your public page.",
      "Tap Save. Next time you take an order, you can attach this design to it.",
    ],
    path: "/designs",
    startLabel: "Open designs",
    doneMessage: "Design added.",
    icon: Palette,
    permission: "design.manage",
  },
];

export function isOnStep(step: GuideStep, pathname: string): boolean {
  return step.matches ? step.matches(pathname) : pathname === step.path;
}
