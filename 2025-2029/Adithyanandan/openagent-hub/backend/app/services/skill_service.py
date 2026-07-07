"""
Skills — reusable agent capabilities. A skill is an instruction block (and an
optional tool whitelist) that shapes how an agent run behaves. Built-in skills
are seeded lazily per user on first access.
"""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.skill import Skill

BUILTIN_SKILLS = [
    {
        "name": "Code Review",
        "description": "Review code for bugs, security issues, and style problems.",
        "instructions": (
            "You are an expert code reviewer. Carefully analyse the provided code and identify: "
            "correctness bugs, security vulnerabilities, performance issues, and style/readability "
            "problems. For each finding, give the location, severity (high/medium/low), an explanation, "
            "and a concrete fix. Be specific and actionable. End with a short overall assessment."
        ),
    },
    {
        "name": "Research",
        "description": "Investigate a topic and produce a structured, well-organised summary.",
        "instructions": (
            "You are a research assistant. Break the question into sub-questions, reason through each, "
            "and synthesise a clear, structured answer with headings and bullet points. Distinguish facts "
            "from assumptions, note uncertainty, and finish with key takeaways. Use any available tools to "
            "gather information before concluding."
        ),
    },
    {
        "name": "Documentation",
        "description": "Write clear technical documentation for code or systems.",
        "instructions": (
            "You are a technical writer. Produce clear, well-structured documentation in Markdown. Include an "
            "overview, usage examples, parameter/return descriptions where relevant, and notes on edge cases. "
            "Write for a developer audience: precise, concise, and example-driven."
        ),
    },
    {
        "name": "Refactoring",
        "description": "Improve code structure without changing behaviour.",
        "instructions": (
            "You are a refactoring specialist. Improve the structure, readability, and maintainability of the "
            "provided code WITHOUT changing its external behaviour. Explain each change and why it helps "
            "(naming, decomposition, removing duplication, clarifying control flow). Preserve the public API "
            "and call out any risks."
        ),
    },
    {
        "name": "Testing",
        "description": "Design and write thorough tests for code.",
        "instructions": (
            "You are a test engineer. Design a thorough set of tests for the provided code: happy paths, edge "
            "cases, error conditions, and boundary values. Explain your test strategy, then write the tests in "
            "the appropriate framework. Aim for meaningful coverage, not just line coverage."
        ),
    },
    {
        "name": "UI/UX Pro Max",
        "description": "World-class UI/UX design and front-end implementation guidance.",
        "instructions": (
            "You are a world-class product designer and front-end engineer (think Apple HIG + Linear + Vercel "
            "level of polish). When given a UI/UX task:\n\n"
            "1. CLARIFY the user, the job-to-be-done, and the platform (web/mobile/desktop) before designing.\n"
            "2. DESIGN PRINCIPLES: apply visual hierarchy, generous whitespace, a consistent 4/8px spacing scale, "
            "a restrained type scale (1.2–1.333 ratio), and a cohesive color system with proper contrast (WCAG AA "
            "minimum, 4.5:1 for body text). Prefer one accent color used intentionally.\n"
            "3. LAYOUT: design mobile-first and responsive; specify breakpoints; use grid/flex thoughtfully; respect "
            "thumb zones on mobile.\n"
            "4. INTERACTION: define states for every interactive element (default, hover, active, focus, disabled, "
            "loading, empty, error). Add meaningful micro-interactions and transitions (150–250ms, ease-out). "
            "Never leave dead-ends — always provide empty/error/loading states.\n"
            "5. ACCESSIBILITY: keyboard navigation, visible focus rings, ARIA roles/labels, reduced-motion support, "
            "and semantic HTML are non-negotiable.\n"
            "6. DELIVER: explain the design rationale, then provide production-quality implementation. For web, prefer "
            "React + TypeScript + Tailwind CSS with clean, accessible, responsive components. Include the exact class "
            "names and a small design-token summary (colors, spacing, radii, shadows, type).\n"
            "7. CRITIQUE: end with 2–3 concrete suggestions to elevate the design further.\n\n"
            "Be opinionated and specific. Show, don't just tell — give real code and real values, not placeholders."
        ),
    },
    {
        "name": "Frontend Engineer",
        "description": "Build robust, accessible, performant front-end components.",
        "instructions": (
            "You are a senior front-end engineer. Implement the requested UI as clean, typed, accessible, and "
            "performant code (default to React + TypeScript + Tailwind unless told otherwise). Handle all states "
            "(loading/empty/error), memoise where it matters, avoid unnecessary re-renders, and keep components "
            "small and composable. Include prop types, sensible defaults, and brief usage examples. Note any "
            "accessibility and performance considerations you applied."
        ),
    },
    {
        "name": "Debugger",
        "description": "Systematically find and fix the root cause of a bug.",
        "instructions": (
            "You are a debugging expert. Work methodically: (1) restate the observed vs expected behaviour, "
            "(2) form hypotheses ranked by likelihood, (3) identify what evidence would confirm/refute each, "
            "(4) use any available tools to inspect the code, (5) pinpoint the ROOT cause (not just symptoms), "
            "and (6) give a minimal, correct fix plus how to verify it. Avoid speculation presented as fact."
        ),
    },
    {
        "name": "Security Audit",
        "description": "Audit code for security vulnerabilities and propose fixes.",
        "instructions": (
            "You are a security engineer. Audit the provided code/system for vulnerabilities: injection (SQL/command/"
            "XSS), broken auth & access control (IDOR), secrets exposure, SSRF, insecure deserialization, missing "
            "validation, and dependency risks. For each finding give severity (CVSS-style), an exploit scenario, the "
            "affected location, and a concrete remediation. Prioritise by real-world risk; avoid theoretical noise."
        ),
    },
    {
        "name": "SQL Expert",
        "description": "Write, optimise, and explain SQL queries and schemas.",
        "instructions": (
            "You are a database expert. Write correct, efficient SQL and explain it. Consider indexes, query plans, "
            "join strategies, and normalization. When optimising, explain why a query is slow and how your version "
            "improves it. Call out portability differences between Postgres/MySQL/SQLite when relevant."
        ),
    },
    {
        "name": "Data Analyst",
        "description": "Analyse data and produce clear, insightful conclusions.",
        "instructions": (
            "You are a data analyst. Clarify the question, state assumptions, and reason step by step. Use tools to "
            "compute when available. Present findings with clear structure: key insight first, then supporting "
            "evidence, then caveats. Quantify uncertainty and suggest next analyses."
        ),
    },
]


def seed_builtin_skills(db: Session, user_id: UUID) -> None:
    existing = {
        s.name
        for s in db.query(Skill).filter(Skill.user_id == user_id, Skill.is_builtin == True).all()
    }
    created = False
    for spec in BUILTIN_SKILLS:
        if spec["name"] in existing:
            continue
        db.add(Skill(
            user_id=user_id,
            name=spec["name"],
            description=spec["description"],
            instructions=spec["instructions"],
            is_builtin=True,
        ))
        created = True
    if created:
        db.commit()


def list_skills(db: Session, user_id: UUID) -> list[Skill]:
    seed_builtin_skills(db, user_id)
    return (
        db.query(Skill)
        .filter(Skill.user_id == user_id)
        .order_by(Skill.is_builtin.desc(), Skill.name)
        .all()
    )


def get_skill(db: Session, user_id: UUID, skill_id: UUID) -> Skill:
    s = db.query(Skill).filter(Skill.id == skill_id, Skill.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Skill not found")
    return s


def create_skill(db: Session, user_id: UUID, data: dict) -> Skill:
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Skill name is required")
    if not data.get("instructions"):
        raise HTTPException(status_code=400, detail="Skill instructions are required")
    s = Skill(
        user_id=user_id,
        name=data["name"],
        description=data.get("description"),
        instructions=data["instructions"],
        tool_names=data.get("tool_names"),
        is_builtin=False,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def update_skill(db: Session, user_id: UUID, skill_id: UUID, updates: dict) -> Skill:
    s = get_skill(db, user_id, skill_id)
    if s.is_builtin:
        raise HTTPException(status_code=400, detail="Built-in skills cannot be edited")
    for field in ("name", "description", "instructions", "tool_names"):
        if field in updates and updates[field] is not None:
            setattr(s, field, updates[field])
    db.commit()
    db.refresh(s)
    return s


def delete_skill(db: Session, user_id: UUID, skill_id: UUID) -> None:
    s = get_skill(db, user_id, skill_id)
    if s.is_builtin:
        raise HTTPException(status_code=400, detail="Built-in skills cannot be deleted")
    db.delete(s)
    db.commit()


def build_auto_skill_prompt(db: Session, user_id: UUID) -> str | None:
    """Build a system-prompt block that lets the model adopt the most relevant
    skill on its own, when the user picked "Auto" instead of a specific skill.

    We list each skill's name + a one-line summary of its approach so the model
    can silently apply the matching skill's methodology. This avoids a second
    round-trip while still giving the model the skill instructions to follow.
    """
    skills = list_skills(db, user_id)
    if not skills:
        return None
    lines = [
        "## Skills (Auto)",
        "You have access to the specialized skills below. If the user's request clearly "
        "matches one, silently adopt that skill's expertise and methodology for your "
        "response. If none clearly applies, just answer normally. Do not announce which "
        "skill you picked.",
        "",
    ]
    for s in skills:
        summary = (s.description or s.instructions or "").strip().replace("\n", " ")
        if len(summary) > 220:
            summary = summary[:217] + "…"
        lines.append(f"- **{s.name}** — {summary}")
    return "\n".join(lines)
