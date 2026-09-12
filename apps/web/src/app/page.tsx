import Image from "next/image";
import Link from "next/link";

const steps = [
  ["01", "Start with a topic", "Add one sentence, a brand, and the outcome you want."],
  ["02", "Shape the script", "Review every hook, beat, visual direction, and call to action."],
  ["03", "Turn it into a reel", "Generate the voice and footage, then arrange it on your timeline."],
] as const;

const beats = [
  { role: "Hook", time: "0:00–0:03", text: "Your best reel might already be hiding in one sentence." },
  { role: "Value", time: "0:03–0:12", text: "VoxReels turns the idea into a structured script you can actually direct." },
  { role: "Proof", time: "0:12–0:20", text: "See the voice, on-screen copy, and visual direction beat by beat." },
  { role: "CTA", time: "0:20–0:25", text: "Edit what matters. Generate when it feels right." },
] as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="VoxReels home">
          <Image src="/logo-transparent.png" alt="" width={46} height={46} priority />
          <span>VoxReels</span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#workflow">How it works</a>
          <a href="#workspace">Workspace</a>
        </nav>

        <div className="auth-actions">
          <Link className="text-link" href="/login">Log in</Link>
          <Link className="button button-dark button-small" href="/register">Start creating</Link>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> From thought to finished reel</p>
          <h1 id="hero-title">One idea.<br /><span>A reel worth watching.</span></h1>
          <p className="hero-description">
            VoxReels turns a rough topic into a directed short-form video—script, voice, visuals, and edit—in one focused workspace.
          </p>

          <form className="topic-composer" action="/register" method="get">
            <label htmlFor="topic">What should your next reel be about?</label>
            <textarea
              id="topic"
              name="topic"
              rows={3}
              placeholder="e.g. Three simple ways to build a better morning routine"
              required
            />
            <div className="composer-footer">
              <span>No perfect prompt needed.</span>
              <button type="submit" className="button button-dark">
                Create my script <ArrowIcon />
              </button>
            </div>
          </form>
        </div>

        <div className="script-preview" aria-label="Example generated script">
          <div className="preview-bar">
            <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
            <span>Script · Draft 01</span>
            <span className="saved-status"><i /> Saved</span>
          </div>
          <div className="preview-heading">
            <div>
              <p>25 second reel</p>
              <h2>Make one idea move.</h2>
            </div>
            <button type="button" aria-label="Play script preview" className="play-button">
              <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16"><path d="m7 5 8 5-8 5V5Z" fill="currentColor" /></svg>
            </button>
          </div>
          <div className="beat-list">
            {beats.map((beat, index) => (
              <article className="beat" key={beat.role} style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}>
                <div className="beat-meta"><strong>{beat.role}</strong><span>{beat.time}</span></div>
                <p>{beat.text}</p>
                <div className="waveform" aria-hidden="true">
                  {[8, 15, 10, 20, 12, 24, 16, 9, 18, 12, 7, 14].map((height, bar) => <i key={bar} style={{ height }} />)}
                </div>
              </article>
            ))}
          </div>
          <div className="preview-footer">
            <span><b>4</b> editable beats</span>
            <span>Voice &amp; visuals come next <ArrowIcon /></span>
          </div>
        </div>
      </section>

      <section className="workflow" id="workflow" aria-labelledby="workflow-title">
        <div className="section-intro">
          <p className="eyebrow"><span /> The workflow</p>
          <h2 id="workflow-title">Creative control stays with you.</h2>
          <p>AI handles the blank page. You make the calls before anything gets generated or published.</p>
        </div>
        <div className="steps">
          {steps.map(([number, title, description]) => (
            <article className="step" key={number}>
              <span className="step-number">{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-section" id="workspace" aria-labelledby="workspace-title">
        <div className="workspace-copy">
          <p className="eyebrow eyebrow-light"><span /> One continuous workspace</p>
          <h2 id="workspace-title">The script is not a dead-end document.</h2>
          <p>Every beat stays connected to its voice, visual, and place on the timeline—from first draft to final export.</p>
          <Link className="button button-light" href="/register">Build your first reel <ArrowIcon /></Link>
        </div>
        <div className="mini-timeline" aria-label="Example VoxReels editing timeline">
          <div className="timeline-toolbar"><b>Extension comparison</b><span>00:25</span></div>
          <div className="timeline-body">
            <div className="track-labels"><span>Visual</span><span>Voice</span><span>Text</span></div>
            <div className="tracks">
              <div className="track visual-track"><i /><i /><i /><i /></div>
              <div className="track audio-track"><i /><i /><i /></div>
              <div className="track text-track"><i /><i /><i /></div>
              <div className="playhead"><span /></div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <Link className="brand brand-footer" href="/">
          <Image src="/logo-transparent.png" alt="" width={42} height={42} />
          <span>VoxReels</span>
        </Link>
        <p>Turn the thought into the reel.</p>
        <span>© {new Date().getFullYear()} VoxReels</span>
      </footer>
    </main>
  );
}
