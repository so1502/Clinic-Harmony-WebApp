import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Cpu, 
  Layers, 
  Settings, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  Clock, 
  User, 
  Home, 
  Wrench, 
  Calendar as CalendarIcon,
  Play,
  Info,
  HelpCircle,
  FileText
} from "lucide-react";

interface Slide {
  id: number;
  title: string;
  category: string;
  notes: string;
  content: React.ReactNode;
}

export default function PresentationPage() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [slideDirection, setSlideDirection] = useState(1); // 1 = next, -1 = prev
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSlide(slides.length - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          setShowIndex((prev) => !prev);
        }
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowNotes((prev) => !prev);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, lightboxImage]);

  const nextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setSlideDirection(1);
      setCurrentSlideIndex((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setSlideDirection(-1);
      setCurrentSlideIndex((prev) => prev - 1);
    }
  };

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setSlideDirection(index > currentSlideIndex ? 1 : -1);
      setCurrentSlideIndex(index);
      setShowIndex(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Error enabling fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Monitor fullscreen change events (e.g. if exited via Escape key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const slideTransition = {
    initial: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? 300 : -300,
    }),
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.4, ease: "easeOut" }
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: direction > 0 ? -300 : 300,
      transition: { duration: 0.3, ease: "easeIn" }
    })
  };

  // Presentation slides content
  const slides: Slide[] = [
    // Slide 1: Title Slide
    {
      id: 1,
      category: "Title",
      title: "Master's Thesis Presentation",
      notes: "Greet the committee. State the official title: 'Design and Development of a Web Application for Intelligent Scheduling in Inpatient Rehabilitation Settings' by Onur Soysal. Research Cluster: Health Tech. Kick-off: Feb 2, 2026. Planned Submission: September 2026. Focus is on clinical resource safety and workflow optimization.",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-10 px-6">
          <div className="relative animate-fade-in">
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 blur-2xl opacity-75 animate-pulse" />
            <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl px-12 py-4 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-yellow-300 animate-bounce" />
              <span className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">Master's Thesis Presentation</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight leading-snug bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent max-w-5xl">
            Design and Development of a Web Application for Intelligent Scheduling in Inpatient Rehabilitation Settings
          </h1>
          
          <div className="w-40 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl text-lg text-slate-400 bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-2xl w-full">
            <div className="text-left space-y-2">
              <span className="block text-slate-500 uppercase tracking-wider text-xs font-bold">Author</span>
              <span className="text-slate-200 font-semibold text-xl">Onur Soysal</span>
              <span className="block text-slate-400 text-sm">Student ID: 2410869033</span>
            </div>
            <div className="text-left space-y-2">
              <span className="block text-slate-500 uppercase tracking-wider text-xs font-bold">Institution &amp; Cluster</span>
              <span className="text-slate-200 font-semibold text-xl">MCI | The Entrepreneurial School</span>
              <span className="block text-slate-400 text-sm">Research Cluster: Health Tech</span>
            </div>
            <div className="text-left space-y-2">
              <span className="block text-slate-500 uppercase tracking-wider text-xs font-bold">Project Milestones</span>
              <span className="text-slate-200 font-semibold text-xl">Kick-off: 02.02.2026</span>
              <span className="block text-slate-400 text-sm">Planned Submission: September 2026</span>
            </div>
          </div>
          
          <p className="text-sm text-slate-500">
            Press <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300">Space</kbd> or <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300">→</kbd> to navigate. Press <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300">Esc</kbd> for slide index.
          </p>
        </div>
      )
    },
    // Slide 2: Agenda
    {
      id: 2,
      category: "Outline",
      title: "Agenda & Overview",
      notes: "Explain that we will walk through motivation, objectives, system architecture, database structure, and live demo steps. Highlight the focus on bullet points for a clean visual flow.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full px-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="p-8 bg-blue-950/30 border border-blue-900/50 rounded-2xl space-y-4">
              <h3 className="text-2xl font-bold text-blue-400">Presentation Journey</h3>
              <p className="text-lg text-slate-300 leading-relaxed">
                A structured walkthrough of the research theory, system design, validation rules, database modeling, localization options, and live webapp demonstration protocol.
              </p>
            </div>
          </div>
          
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { num: "01", title: "Motivation & Problem", desc: "Rehab scheduling challenges" },
              { num: "02", title: "Research Questions", desc: "Thesis leading and sub-questions" },
              { num: "03", title: "Research Methodology", desc: "Design Science Research Framework" },
              { num: "04", title: "System Architecture", desc: "Ecosystem: Client, Validator, Supabase" },
              { num: "05", title: "PostgreSQL Database Schema", desc: "Tables, triggers, and constraints" },
              { num: "06", title: "User Roles & Onboarding", desc: "RBAC permissions and registration flow" },
              { num: "07", title: "Room & Equipment Constraints", desc: "Capacities and active statuses" },
              { num: "08", title: "Deterministic Validation Engine", desc: "Real-time conflict prevention firewall" },
              { num: "09", title: "AI Scheduling Module", desc: "Gemini JSON parsing & sandbox review" },
              { num: "10", title: "Interactive Interfaces", desc: "Calendar booking and room selection UI" },
              { num: "11", title: "Multi-Language (i18n)", desc: "German and English dynamic support" },
              { num: "12", title: "Administrative Dashboards", desc: "Patients, staff, inventory, and pinboard" },
              { num: "13", title: "Quality Assurance & Testing", desc: "E2E automated Playwright tests" },
              { num: "14", title: "Expected Results & Evaluation", desc: "Preliminary user tests and efficiency metrics" },
              { num: "15", title: "Conclusion & Milestones", desc: "Deadlines, roadmap, and open floor" }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-indigo-500/30 transition-colors">
                <span className="text-base font-bold text-indigo-400 bg-indigo-950/50 border border-indigo-900/50 px-3 py-1.5 rounded-lg">
                  {item.num}
                </span>
                <div>
                  <h4 className="text-sm lg:text-base font-bold text-slate-200">{item.title}</h4>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    // Slide 3: Motivation & Problem Statement
    {
      id: 3,
      category: "Theory",
      title: "Motivation & Problem Statement",
      notes: "Discuss that manual methods (paper/excel) are inefficient and error-prone. Mention the specific challenges of inpatient rehabilitation, where patient volumes, therapy types, and interdisciplinary resource limits collision.",
      content: (
        <div className="flex flex-col justify-center h-full px-6 space-y-8">
          <h3 className="text-2xl lg:text-4xl font-extrabold text-slate-100">
            Rehabilitation Scheduling Challenges
          </h3>
          <ul className="space-y-6 text-lg lg:text-2xl text-slate-300">
            <li className="flex items-start gap-3">
              <span className="text-blue-500 text-3xl shrink-0">📋</span>
              <span><strong>Manual Planning Limitations</strong>: Traditional paper boards, templates, and spreadsheets are highly error-prone, static, and inefficient.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-indigo-500 text-3xl shrink-0">⚠️</span>
              <span><strong>Resource Collision Vulnerability</strong>: Complex clinical environments face frequent scheduling overlaps between therapists, patients, rooms, and devices.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-500 text-3xl shrink-0">⏳</span>
              <span><strong>High Administrative Overload</strong>: Manual coordination consumes excessive planning time that should instead focus directly on patient rehabilitation.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-500 text-3xl shrink-0">💡</span>
              <span><strong>Urgent Need for Automation</strong>: Clinics require a robust digital scheduler with integrated validation logic and smart planning assistants.</span>
            </li>
          </ul>
        </div>
      )
    },
    // Slide 4: Research Questions & Objectives
    {
      id: 4,
      category: "Theory",
      title: "Research Questions & Objectives",
      notes: "Detail the primary question and the two supporting sub-questions. Explain that we cover resource modeling and constraint optimization on one side, and LLM automation/user interfaces on the other.",
      content: (
        <div className="flex flex-col justify-center h-full px-6 space-y-6">
          <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-indigo-500/30 p-6 rounded-2xl max-w-5xl mx-auto w-full">
            <span className="block text-sm font-bold text-indigo-300 uppercase tracking-wider mb-2">Primary Research Question</span>
            <p className="text-xl lg:text-3xl text-white font-semibold italic leading-relaxed">
              "How can an intelligent scheduling system improve planning accuracy, reduce administrative workload, and support clinical workflows in inpatient rehabilitation environments?"
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full pt-4">
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <h4 className="text-lg lg:text-xl font-bold text-blue-400 flex items-center gap-2">
                <Cpu className="h-6 w-6" /> Sub-Question 1: Constraint Modeling
              </h4>
              <p className="text-base lg:text-lg text-slate-300 leading-relaxed">
                How can multi-dimensional clinical constraints (therapist specialties, room capacity limits, active/maintenance equipment, and patient timelines) be modeled algorithmically to optimize resource allocation?
              </p>
            </div>
            
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <h4 className="text-lg lg:text-xl font-bold text-indigo-400 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" /> Sub-Question 2: Hybrid Automation
              </h4>
              <p className="text-base lg:text-lg text-slate-300 leading-relaxed">
                How can Large Language Models (LLMs) and natural language inputs be integrated with deterministic validations to supply clinical staff with safe, semi-automated scheduling workflows?
              </p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 5: Research Methodology
    {
      id: 5,
      category: "Theory",
      title: "Research Methodology & Strategy",
      notes: "Focus on Design Science Research (DSR). Show the evaluation methods (Likert Scale, Usability testing, completion time metrics) to show how we measure the artifact's success.",
      content: (
        <div className="flex flex-col justify-center h-full px-6 space-y-6">
          <h3 className="text-xl lg:text-3xl font-bold text-slate-100">
            Design Science Research (DSR) Framework
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-lg lg:text-xl font-bold text-indigo-400">DSR Methodology (Hevner et al., 2004)</h4>
              <ul className="space-y-3 text-base lg:text-lg text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">●</span>
                  <span><strong>Goal</strong>: Develop an innovative IT artifact addressing clinical scheduling.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">●</span>
                  <span><strong>Relevance</strong>: Driven by real coordination pains and staff workload.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">●</span>
                  <span><strong>Rigor</strong>: Enforces strict data models, security controls, and rules.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg lg:text-xl font-bold text-emerald-400">Evaluation Strategy &amp; Metrics</h4>
              <ul className="space-y-3 text-base lg:text-lg text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">●</span>
                  <span><strong>Usability Testing</strong>: System Usability Scale (SUS) and Likert feedback.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">●</span>
                  <span><strong>Time Metrics</strong>: Comparing manual entry against AI scheduling.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">●</span>
                  <span><strong>Automated Testing</strong>: End-to-end regression tests via Playwright.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    // Slide 6: System Architecture Diagram
    {
      id: 6,
      category: "Architecture",
      title: "System Architecture & Ecosystem Flow",
      notes: "Explain the four key layers: Frontend Client, TypeScript Validation Firewall, BaaS Backend (Supabase), and the Gemini API scheduler module.",
      content: (
        <div className="flex flex-col justify-center h-full px-6 space-y-8">
          {/* Visual Architecture Chart */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center max-w-5xl mx-auto w-full pt-4">
            {/* Box 1: UI Client */}
            <div className="p-6 bg-slate-950 border border-blue-900/50 rounded-2xl text-center space-y-4 relative shadow-md">
              <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">Client</span>
              <Layers className="h-8 w-8 text-blue-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-200">React Interface</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Interactive calendar, dashboards, and live pinboard.</p>
            </div>
            
            <div className="text-center text-slate-500 hidden md:block text-2xl">➔</div>
            
            {/* Box 2: Local Validation */}
            <div className="p-6 bg-slate-950 border border-indigo-900/50 rounded-2xl text-center space-y-4 relative shadow-md">
              <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">Validator</span>
              <Cpu className="h-8 w-8 text-indigo-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-200">TypeScript Engine</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Deterministic overlap checks and constraints validation.</p>
            </div>
            
            <div className="text-center text-slate-500 hidden md:block text-2xl">➔</div>
            
            {/* Box 3: Supabase */}
            <div className="p-6 bg-slate-950 border border-emerald-900/50 rounded-2xl text-center space-y-4 relative shadow-md">
              <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">BaaS</span>
              <Database className="h-8 w-8 text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-200">Supabase DB</h4>
              <p className="text-xs text-slate-400 leading-relaxed">PostgreSQL schema, triggers, and RLS data security.</p>
            </div>
          </div>
          
          <ul className="space-y-3 text-base lg:text-lg text-slate-300 max-w-4xl mx-auto w-full">
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold">●</span>
              <span><strong>Unified Security Pipeline</strong>: All edits (drag-drop, forms, AI generation) go through the TypeScript Validator before db write.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold">●</span>
              <span><strong>AI Assistant (Gemini)</strong>: Acts as a smart parsing module, outputting structured JSON proposal lists to the validator sandbox.</span>
            </li>
          </ul>
        </div>
      )
    },
    // Slide 7: Database & Tenancy Schema
    {
      id: 7,
      category: "Database",
      title: "Supabase Relational Database Schema",
      notes: "Go through the actual database structure. Highlight the tables clinics, profiles, user_roles, invitations, therapists, patients (with ssn, insurance), rooms, equipment, appointments, and room_equipment/therapy_type_equipment junction tables. Emphasize how RLS uses the clinic_id for tenancy isolation, preventing cross-clinic data leaks, while PostgreSQL check constraints handle active/maintenance states.",
      content: (
        <div className="flex flex-col justify-center h-full px-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
            {/* Col 1: Core & Auth */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Database className="h-5 w-5" /> Core &amp; Authorization
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.clinics</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Tenant boundary configuration</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.profiles</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Clinician credentials metadata</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.user_roles</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">RBAC permissions hierarchy</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.invitations</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Admin onboarding signup tokens</span>
                </div>
              </div>
            </div>

            {/* Col 2: Clinical Resources */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="h-5 w-5" /> Clinical Resources
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.therapists</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Specialties &amp; availability colors</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.patients</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">SVN, insurance plan, contacts</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.rooms</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Physical capacities and limits</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.equipment</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Inventory items &amp; maintenance flags</span>
                </div>
              </div>
            </div>

            {/* Col 3: Events & Junctions */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Settings className="h-5 w-5" /> Events &amp; Junctions
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.appointments</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Core scheduled booking entries</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.room_equipment</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Device mapping location tracking</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.therapy_type_equipment</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Treatment device requirements</span>
                </div>
                <div className="flex flex-col items-start bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <code className="font-bold text-slate-200 text-xs lg:text-sm">public.therapy_types</code>
                  <span className="text-[10px] lg:text-xs text-slate-500 font-medium">Session configurations &amp; colors</span>
                </div>
              </div>
            </div>
          </div>
          
          <ul className="space-y-2 text-base lg:text-lg text-slate-400 max-w-4xl mx-auto w-full text-center">
            <li className="inline-flex items-center gap-2 mr-6">
              <span className="text-blue-500">🛡️</span>
              <span><strong>Row Level Security (RLS)</strong> isolates clinics dynamically.</span>
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="text-purple-500">⚙️</span>
              <span><strong>Foreign Keys &amp; CHECK Constraints</strong> enforce data integrity at db level.</span>
            </li>
          </ul>
        </div>
      )
    },
    // Slide 8: User Roles & Invitation Flow
    {
      id: 8,
      category: "Management",
      title: "User Roles, Permissions & Invitation System",
      notes: "Discuss the roles and the secure token invitation workflow. Explain that triggers on public.profiles map users on signup, and active invitations link them to their clinic ID.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full px-6">
          <div className="space-y-6">
            <h3 className="text-xl lg:text-3xl font-bold text-slate-100">
              Staff Onboarding &amp; Security
            </h3>
            <ul className="space-y-4 text-base lg:text-lg text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Secure Invitation Tokens</strong>: Admins send invitation tokens mapping user email to a target role.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>One-Time Token Consumption</strong>: Invitee registers via link; database marks the token as used (<code>is_consumed = true</code>).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Automated Account Linking</strong>: Database triggers automatically tie the new user profile and roles to the inviting clinic.</span>
              </li>
            </ul>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {[
              { role: "System Admin", desc: "Global setup, clinic registrations, schema migrations." },
              { role: "Clinic Admin", desc: "Local settings, team onboarding, room/device inventory." },
              { role: "Receptionist", desc: "Patient demographic CRUD, appointment calendar booking." },
              { role: "Therapist", desc: "Calendar viewing, bio/specialization edits, medical note updates." }
            ].map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500/30 transition-colors">
                <h4 className="text-sm font-bold text-indigo-300">{item.role}</h4>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )
    },
    // Slide 9: Inpatient Rehab Resource Constraints: Rooms & Equipment
    {
      id: 9,
      category: "Resources",
      title: "Rehab Resource Planning: Rooms & Equipment",
      notes: "Explain room capacities and equipment maintenance cycles. Explain the mapping in room_equipment and therapy_type_equipment that links device requirements to physical room booking criteria.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full px-6">
          <div className="space-y-6">
            <h3 className="text-xl lg:text-3xl font-bold text-slate-100">
              Capacity &amp; Inventory Modeling
            </h3>
            
            <ul className="space-y-4 text-base lg:text-lg text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Multi-Patient Rooms</strong>: Rooms (e.g. gym, pool) support multiple parallel slots up to their capacity limit.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Active Maintenance States</strong>: Devices marked for maintenance are blocked from active bookings.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Treatment Requirements</strong>: Therapy types specify necessary devices, auto-filtering suitable treatment rooms.</span>
              </li>
            </ul>
          </div>
          
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Relational Constraint Rules</h4>
            
            <div className="space-y-3 text-xs lg:text-sm">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="font-bold text-blue-400">public.room_equipment</span>
                <p className="text-slate-400 mt-1 leading-relaxed">
                  Junction table. Links equipment items directly to rooms, ensuring hardware resides in the booking location.
                </p>
              </div>
              
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="font-bold text-purple-400">public.therapy_type_equipment</span>
                <p className="text-slate-400 mt-1 leading-relaxed">
                  Enforces device requirements. The scheduler filters out rooms lacking the required active equipment.
                </p>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 italic text-center">
              PostgreSQL CHECK constraints enforce: status IN ('active', 'maintenance')
            </p>
          </div>
        </div>
      )
    },
    // Slide 10: Deterministic Conflict Validation Engine
    {
      id: 10,
      category: "Validation",
      title: "Deterministic Validation Engine",
      notes: "Emphasize that all booking inputs—manual drag-and-drops, creations, and AI proposals—go through the same validation checks. Review the checklist: patient overlap, therapist overlap, room capacity, equipment status, and clinic hours.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full px-6">
          <div className="space-y-6">
            <h3 className="text-xl lg:text-3xl font-bold text-slate-100">
              The Schedule Validation Firewall
            </h3>
            
            <ul className="space-y-3 text-base lg:text-lg text-slate-300">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span><strong>Patient Availability</strong>: Blocks overlapping sessions.</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span><strong>Therapist Availability</strong>: Verifies staff timelines and work hours.</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span><strong>Room Capacity Boundaries</strong>: Prevents overflowing treatment areas.</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span><strong>Active Device Status</strong>: Rejects rooms lacking required active hardware.</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span><strong>Operating Hours</strong>: restructures bookings (07:30 - 17:30, Mon - Fri).</span>
              </li>
            </ul>
          </div>
          
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-center text-center space-y-4">
            <span className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Real-time Constraints Checking</span>
            <div className="w-20 h-20 rounded-full bg-indigo-950/50 border border-indigo-900/50 flex items-center justify-center mx-auto text-indigo-400 shadow-lg">
              <Cpu className="h-10 w-10 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              Provides instant UI feedback during drag-and-drop actions, forms, or AI proposals, securing the relational database transactions.
            </p>
          </div>
        </div>
      )
    },
    // Slide 11: AI-Assisted Scheduling Assistant
    {
      id: 11,
      category: "AI Engine",
      title: "AI-Assisted Scheduling Assistant",
      notes: "Explain that the AI acts as a smart plan generator, translating natural language into JSON. Show how proposals are visual and can be reviewed or deleted before commit.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full px-6">
          <div className="space-y-6">
            <h3 className="text-xl lg:text-3xl font-bold text-slate-100">
              Natural Language Scheduling
            </h3>
            <ul className="space-y-4 text-base lg:text-lg text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Natural Language Input</strong>: Translates instructions like <em>"Schedule 5 physiotherapy sessions for Jane"</em> into structured slots.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Context-Aware System state</strong>: Injects current calendar occupancy, therapist schedules, and active rooms into the model prompt.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Human-in-the-Loop</strong>: Generates temporary "proposals" in a staging sandbox. Admins edit or delete slots before submitting them to PostgreSQL.</span>
              </li>
            </ul>
          </div>
          
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <span className="text-sm font-bold text-indigo-300 uppercase tracking-wider block text-center">AI Sandbox Proposal Checks</span>
            <div className="space-y-3 text-xs lg:text-sm">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-200">Mon, 15.06.2026 at 09:00</div>
                  <span className="text-[10px] text-slate-500">Therapist: Onur Soysal | Room: Therapy Room 1</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/20 px-2.5 py-1 rounded border border-emerald-900/50">VALID</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-200">Wed, 17.06.2026 at 09:00</div>
                  <span className="text-[10px] text-slate-500">Therapist: Onur Soysal | Room: Gym</span>
                </div>
                <span className="text-xs font-bold text-rose-400 bg-rose-950/20 px-2.5 py-1 rounded border border-rose-900/50">OVERLAP (Room Full)</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 12: Interactive Interfaces
    {
      id: 12,
      category: "Features",
      title: "Interactive Interfaces & Visual Checks",
      notes: "Point out the screenshots of the web application. The left image shows the calendar screen after clicking 'Neuer Termin', and the right shows the subdialog with color-coded capacity indicators. Click on screenshots to enlarge.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full items-center px-6">
          {/* Screenshot 1 */}
          <div className="space-y-2 text-center">
            <span className="text-base lg:text-lg font-bold text-blue-400 uppercase tracking-wider">1. Appointment Booking interface</span>
            <div 
              className="relative rounded-xl border border-slate-800 overflow-hidden shadow-2xl bg-slate-950 p-1 cursor-zoom-in group"
              onClick={() => setLightboxImage("/after_click_neuer_termin.png")}
            >
              <img 
                src="/after_click_neuer_termin.png" 
                alt="Calendar Booking Interface" 
                className="w-full aspect-[4/3] object-cover hover:scale-[1.02] transition-transform duration-300 rounded-lg max-h-[300px]"
              />
              <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">Click to Zoom</div>
            </div>
            <p className="text-xs lg:text-sm text-slate-400 max-w-md mx-auto mt-2">
              Main scheduling dialog overlay on the timeline, linking patients, therapists, and equipments.
            </p>
          </div>

          {/* Screenshot 2 */}
          <div className="space-y-2 text-center">
            <span className="text-base lg:text-lg font-bold text-indigo-400 uppercase tracking-wider">2. Room Availability &amp; Capacity Check</span>
            <div 
              className="relative rounded-xl border border-slate-800 overflow-hidden shadow-2xl bg-slate-950 p-1 cursor-zoom-in group"
              onClick={() => setLightboxImage("/subdialog.png")}
            >
              <img 
                src="/subdialog.png" 
                alt="Room Capacity Subdialog" 
                className="w-full aspect-[4/3] object-cover hover:scale-[1.02] transition-transform duration-300 rounded-lg max-h-[300px]"
              />
              <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">Click to Zoom</div>
            </div>
            <p className="text-xs lg:text-sm text-slate-400 max-w-md mx-auto mt-2">
              Room selector subdialog highlighting active capacity, total limit bounds, and conflicts.
            </p>
          </div>
        </div>
      )
    },
    // Slide 13: Multi-Language & Localization
    {
      id: 13,
      category: "Features",
      title: "Multi-Language & Localization (i18n)",
      notes: "Point out the screenshots demonstrating the application's complete i18n capabilities. The left image shows the 'Stecktafel' (Pegboard) interface fully localized in German, while the right displays the 'Calendar' view localized in English, including localized calendar headers, forms, and date formatting (e.g. DD.MM.YYYY vs MM/DD/YYYY). Click on screenshots to enlarge.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full items-center px-6">
          {/* Screenshot 1 */}
          <div className="space-y-2 text-center">
            <span className="text-base lg:text-lg font-bold text-indigo-400 uppercase tracking-wider">Localized German (DE) UI - Stecktafel</span>
            <div 
              className="relative rounded-xl border border-slate-800 overflow-hidden shadow-2xl bg-slate-950 p-1 cursor-zoom-in group"
              onClick={() => setLightboxImage("/stecktafel_de.png")}
            >
              <img 
                src="/stecktafel_de.png" 
                alt="German Stecktafel Interface" 
                className="w-full aspect-[16/9] object-cover hover:scale-[1.02] transition-transform duration-300 rounded-lg max-h-[260px]"
              />
              <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">Click to Zoom</div>
            </div>
            <p className="text-xs lg:text-sm text-slate-400 max-w-md mx-auto mt-2">
              Bilingual planning boards with customizable standard blocks (Duschen, Baden, Essen, Ruhepause).
            </p>
          </div>

          {/* Screenshot 2 */}
          <div className="space-y-2 text-center">
            <span className="text-base lg:text-lg font-bold text-blue-400 uppercase tracking-wider">Localized English (EN) UI - Calendar</span>
            <div 
              className="relative rounded-xl border border-slate-800 overflow-hidden shadow-2xl bg-slate-950 p-1 cursor-zoom-in group"
              onClick={() => setLightboxImage("/calendar_en.png")}
            >
              <img 
                src="/calendar_en.png" 
                alt="English Calendar Interface" 
                className="w-full aspect-[16/9] object-cover hover:scale-[1.02] transition-transform duration-300 rounded-lg max-h-[260px]"
              />
              <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">Click to Zoom</div>
            </div>
            <p className="text-xs lg:text-sm text-slate-400 max-w-md mx-auto mt-2">
              Weekly view featuring AI Assistant and New Appointment overlays localized for English-speaking clinicians.
            </p>
          </div>
        </div>
      )
    },
    // Slide 14: Administrative Management Modules
    {
      id: 14,
      category: "Platform",
      title: "Administrative Management Modules",
      notes: "Walk through Patients CRUD (SSN/SVN details, emergency contacts), Staff directory, Equipment registry (maintenance toggles), and the Pinboard shared bulletin board.",
      content: (
        <div className="flex flex-col justify-center h-full px-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto w-full pt-4">
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-blue-500/30 transition-colors">
              <span className="text-sm font-bold text-blue-400 uppercase tracking-wider block">Patients CRUD</span>
              <ul className="space-y-2 text-xs lg:text-sm text-slate-400">
                <li>• Demographics &amp; language preferences.</li>
                <li>• Insurance providers &amp; policy numbers.</li>
                <li>• SSN/SVN numbers &amp; emergency contacts.</li>
              </ul>
            </div>
            
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-purple-500/30 transition-colors">
              <span className="text-sm font-bold text-purple-400 uppercase tracking-wider block">Staff &amp; Team</span>
              <ul className="space-y-2 text-xs lg:text-sm text-slate-400">
                <li>• Clinical specializations &amp; bio details.</li>
                <li>• Dynamic calendar timeline color markers.</li>
                <li>• Active registration states tracking.</li>
              </ul>
            </div>
            
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-emerald-500/30 transition-colors">
              <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider block">Inventory Suite</span>
              <ul className="space-y-2 text-xs lg:text-sm text-slate-400">
                <li>• Room capacity settings.</li>
                <li>• Equipment status check configurations.</li>
                <li>• Maintenance flags toggling control.</li>
              </ul>
            </div>
            
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 hover:border-yellow-500/30 transition-colors">
              <span className="text-sm font-bold text-yellow-400 uppercase tracking-wider block">Real-time Pinboard</span>
              <ul className="space-y-2 text-xs lg:text-sm text-slate-400">
                <li>• Dynamic bulletin boards.</li>
                <li>• Real-time announcement syncing.</li>
                <li>• Post creation &amp; automatic client broadcast.</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    // Slide 15: Quality Assurance & Playwright Testing
    {
      id: 15,
      category: "Testing",
      title: "Quality Assurance & Automated Testing",
      notes: "Discuss our Playwright testing framework. Explain that we simulate end-to-end user flows to verify: clinic RLS data separation, patient/therapist double-booking blocks, and room capacity limit checks.",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full px-6">
          <div className="space-y-6">
            <h3 className="text-xl lg:text-3xl font-bold text-slate-100">
              E2E Automated Testing
            </h3>
            <ul className="space-y-4 text-base lg:text-lg text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Simulating User Operations</strong>: Runs automated Playwright workflows verifying booking calendars and drag-and-drop actions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Relational Overlap Assertions</strong>: Validates that double bookings or capacity overflows correctly trigger warnings.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">●</span>
                <span><strong>Cross-Clinic Security Verification</strong>: Confirms that RLS security rules prevent Clinic A staff from querying Clinic B.</span>
              </li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider block text-center">E2E Test Coverage Scenarios</h4>
            <div className="space-y-3 text-xs lg:text-sm">
              {[
                { name: "Tenant RLS Separation test", status: "PASSED", desc: "Blocks data access across different clinic boundaries." },
                { name: "Patient Overlap rejection", status: "BLOCKED", desc: "Ensures overlapping client timeslots trigger validation failures." },
                { name: "Room Capacity overflow block", status: "BLOCKED", desc: "Rejects scheduling more patients than physical space capacity." },
                { name: "Equipment Maintenance check", status: "BLOCKED", desc: "Asserts booking blocks if required equipment is in maintenance." }
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-200">{item.name}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 border rounded uppercase ${
                    item.status === "PASSED" 
                      ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/50" 
                      : "text-amber-400 bg-amber-950/20 border-amber-900/50"
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    // Slide 16: Expected Results & Evaluation
    {
      id: 16,
      category: "Evaluation",
      title: "Expected Results & Evaluation Metrics",
      notes: "Present the expected/preliminary outcomes of the Design Science Research (DSR) artifact. Point out that while this is a pre-presentation for feedback, target achievements are modeled based on pilot simulation walkthroughs and early receptionist interviews.",
      content: (
        <div className="flex flex-col justify-center h-full px-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto w-full pt-4">
            {/* Card 1: Scheduling Efficiency */}
            <div className="p-6 bg-slate-900 border border-blue-900/50 rounded-2xl text-center space-y-4 hover:border-blue-500/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-950/50 border border-blue-900/50 flex items-center justify-center text-blue-400 mx-auto animate-pulse">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Planning Efficiency</h4>
                <div className="text-2xl font-extrabold text-blue-400 mt-2">~15 Min</div>
                <span className="text-[10px] text-slate-500 block mt-0.5">vs. 120+ min manually</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reduces weekly patient therapy planning workload by **~87%** through smart automation and localized templates.
              </p>
            </div>

            {/* Card 2: Usability Target */}
            <div className="p-6 bg-slate-900 border border-purple-900/50 rounded-2xl text-center space-y-4 hover:border-purple-500/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-900/50 flex items-center justify-center text-purple-400 mx-auto animate-pulse">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Usability (SUS)</h4>
                <div className="text-2xl font-extrabold text-purple-400 mt-2">&gt; 80 / 100</div>
                <span className="text-[10px] text-slate-500 block mt-0.5">System Usability Scale Goal</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aims for an **"Excellent" usability grade** with intuitive drag-and-drop mechanics and minimal screen transitions.
              </p>
            </div>

            {/* Card 3: Conflict Prevention */}
            <div className="p-6 bg-slate-900 border border-emerald-900/50 rounded-2xl text-center space-y-4 hover:border-emerald-500/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Schedule Integrity</h4>
                <div className="text-2xl font-extrabold text-emerald-400 mt-2">100% Safe</div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Zero Double Bookings</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deterministic validation firewall intercepts all overlap attempts, ensuring reliable clinical resource utilization.
              </p>
            </div>

            {/* Card 4: AI Acceptance Rate */}
            <div className="p-6 bg-slate-900 border border-yellow-900/50 rounded-2xl text-center space-y-4 hover:border-yellow-500/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-yellow-950/50 border border-yellow-900/50 flex items-center justify-center text-yellow-400 mx-auto animate-pulse">
                <Cpu className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">AI Approval Rate</h4>
                <div className="text-2xl font-extrabold text-yellow-400 mt-2">~90%</div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Acceptance in Sandbox</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Most AI-proposed schedules require no manual modifications before committing to the database.
              </p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 17: Conclusion & Q&A
    {
      id: 17,
      category: "Ending",
      title: "Conclusion & Q&A Session",
      notes: "Summarize the work and thank the committee. Remind them of the project milestones: Kick-off on Feb 2, 2026, half-time in April, final meeting in July, and planned submission in September 2026. Transition to Q&A.",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl">
            <CheckCircle2 className="h-12 w-12 text-white animate-bounce" />
          </div>
          
          <h2 className="text-xl lg:text-3xl font-extrabold text-slate-100 max-w-4xl leading-snug">
            Intelligent Inpatient Scheduling &amp; Clinic Management Platform
          </h2>
          
          <ul className="space-y-2 text-base lg:text-xl text-slate-300 max-w-3xl text-left list-disc pl-6 mx-auto">
            <li>Integrates complex multi-tenant client scheduling with PostgreSQL Row Level Security (RLS) protections.</li>
            <li>Enforces deterministic capacity and equipment maintenance restrictions.</li>
            <li>Enables AI scheduling assistants with Human-in-the-Loop review and approval.</li>
            <li>Validated through automated testing and clinical usability benchmarks.</li>
          </ul>
          
          <div className="w-32 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl text-xs lg:text-sm">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="block font-bold text-indigo-400">02.02.2026</span>
              <span className="text-slate-400 text-xs">Kick-off Meeting</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="block font-bold text-indigo-400">01.04.2026</span>
              <span className="text-slate-400 text-xs">Half-time Meeting</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="block font-bold text-indigo-400">01.07.2026</span>
              <span className="text-slate-400 text-xs">Final Meeting</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="block font-bold text-indigo-400">September 2026</span>
              <span className="text-slate-400 text-xs">Planned Submission</span>
            </div>
          </div>
          
          <div className="pt-2">
            <Link to="/dashboard" className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-center transition-colors shadow-lg inline-flex items-center gap-2 text-sm">
              <Play className="h-4 w-4 fill-current" /> Launch Clinic-Harmony App
            </Link>
          </div>
          
          <p className="text-sm text-slate-500 italic">
            Thank you for your attention. Open for questions and the live demonstration.
          </p>
        </div>
      )
    }
  ];

  const currentSlide = slides[currentSlideIndex];

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden relative"
    >
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-3 bg-slate-900 border border-slate-800 rounded-lg"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to App
          </Link>
          <span className="text-slate-600">|</span>
          <span className="text-sm font-bold text-slate-200">Clinic-Harmony Master Thesis</span>
        </div>

        {/* Slide Counter / Category Badge */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-full">
            {currentSlide.category}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {currentSlideIndex + 1} / {slides.length}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotes((prev) => !prev)}
            className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
              showNotes 
                ? "bg-indigo-600 border-indigo-500 text-white" 
                : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
            title="Toggle speaker notes (Press N)"
          >
            <Info className="h-4 w-4" /> 
            <span className="hidden sm:inline">Speaker Notes</span>
          </button>
          
          <button
            onClick={() => setShowIndex((prev) => !prev)}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Slide Index (Press Esc)"
          >
            <BookOpen className="h-4 w-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Toggle Fullscreen (Press F)"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Slide Presentation Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden z-0">
        <div className="w-full max-w-6xl h-full flex flex-col justify-center">
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={currentSlideIndex}
              custom={slideDirection}
              variants={slideTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full h-full min-h-[450px]"
            >
              {/* Slide Title */}
              {currentSlide.id > 1 && (
                <div className="mb-6 space-y-1">
                  <h2 className="text-2xl lg:text-4xl font-extrabold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    {currentSlide.title}
                  </h2>
                  <div className="w-16 h-1 bg-indigo-500 rounded-full" />
                </div>
              )}

              {/* Slide Content Body */}
              <div className="flex-1 w-full h-full py-4 text-slate-300">
                {currentSlide.content}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Slide Navigation Progress Bar */}
      <div className="w-full h-1 bg-slate-900 shrink-0">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
          style={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Navigation Controls Bar at the bottom */}
      <footer className="h-16 px-6 border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between z-10 shrink-0 text-sm text-slate-500">
        <div>
          <span className="hidden sm:inline">Use Arrow keys or Space to navigate</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={prevSlide}
            disabled={currentSlideIndex === 0}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <span className="font-mono text-xs text-slate-400">
            Slide {currentSlideIndex + 1} of {slides.length}
          </span>

          <button
            onClick={nextSlide}
            disabled={currentSlideIndex === slides.length - 1}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div>
          <span className="font-bold text-slate-400">Clinic-Harmony</span>
        </div>
      </footer>

      {/* Collapsible Speaker Notes Drawer */}
      {showNotes && (
        <div className="bg-indigo-950/95 border-t border-indigo-900 px-6 py-4 z-20 shadow-2xl relative transition-all duration-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
              <Info className="h-4 w-4" /> Presenter Notes (Slide {currentSlideIndex + 1})
            </span>
            <button
              onClick={() => setShowNotes(false)}
              className="text-indigo-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-sans max-w-5xl">
            {currentSlide.notes}
          </p>
        </div>
      )}

      {/* Slides Index Drawer (Escape Key) */}
      <AnimatePresence>
        {showIndex && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-6"
            onClick={() => setShowIndex(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-400" /> Table of Slides (Esc)
                </span>
                <button
                  onClick={() => setShowIndex(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(idx)}
                    className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                      idx === currentSlideIndex
                        ? "bg-indigo-600/20 border-indigo-500/80 shadow-md text-white font-bold"
                        : "bg-slate-950/60 border-slate-800/85 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] font-mono tracking-wider uppercase opacity-65 mb-1">
                      <span>Slide {slide.id}</span>
                      <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{slide.category}</span>
                    </div>
                    <h4 className="text-xs truncate">{slide.title}</h4>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center cursor-zoom-out animate-fade-in animate-duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
          >
            <X className="h-6 w-6" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Enlarged screenshot" 
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl border border-slate-800 shadow-2xl animate-scale-in"
          />
        </div>
      )}
    </div>
  );
}
