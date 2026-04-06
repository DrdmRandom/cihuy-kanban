import Image from "next/image";
import ThemeToggle from "@/components/theme-toggle";
import TypingName from "@/components/typing-name";
import { getPortfolioData, splitTags } from "@/lib/strapi";

function ProjectLinks({ repoUrl, liveUrl, status }) {
  return (
    <div className="project-links">
      {liveUrl ? (
        <a href={liveUrl} target="_blank" rel="noreferrer">
          Open live site
        </a>
      ) : (
        <span className="soft-chip">
          {status === "private" ? "Private deployment" : "No live URL"}
        </span>
      )}
      {repoUrl ? (
        <a href={repoUrl} target="_blank" rel="noreferrer">
          Source code
        </a>
      ) : (
        <span className="soft-chip">
          {status === "private" ? "Private repository" : "Repo unavailable"}
        </span>
      )}
    </div>
  );
}

function ExperienceCard({ experience }) {
  return (
    <article className="experience-card">
      <div className="experience-topline">
        <span>{experience.period}</span>
        <span>{experience.location}</span>
      </div>
      <h3>{experience.role}</h3>
      <p className="experience-company">{experience.company}</p>
      <p>{experience.summary}</p>
    </article>
  );
}

function PublicProjectCard({ project, index }) {
  const tags = splitTags(project.tags).slice(0, 6);
  const status = String(project.Statuss || "private").toLowerCase();

  return (
    <article className="showcase-card">
      <div className="showcase-number">0{index + 1}</div>
      <div className="showcase-content">
        <div className="showcase-header">
          <span className={`status-pill ${status}`}>{status}</span>
          <h3>{project.title}</h3>
        </div>
        <p>{project.description}</p>
        <div className="tag-row">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <ProjectLinks repoUrl={project.repo_url} liveUrl={project.live_url} status={status} />
      </div>
    </article>
  );
}

function PrivateProjectCard({ project }) {
  return (
    <article className="lab-card">
      <div className="lab-head">
        <h4>{project.title}</h4>
        <span>Private</span>
      </div>
      <p>{project.description}</p>
    </article>
  );
}

export default async function HomePage() {
  const { experiences, projects } = await getPortfolioData();
  const publicProjects = projects.filter(
    (project) => String(project.Statuss || "").toLowerCase() === "public"
  );
  const privateProjects = projects.filter(
    (project) => String(project.Statuss || "").toLowerCase() !== "public"
  );

  return (
    <main className="page-shell">
      <header className="masthead">
        <div className="brand-mark">Dawwi</div>
        <nav className="masthead-nav">
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#experience">Experience</a>
        </nav>
        <ThemeToggle />
      </header>

      <section className="hero-stage">
        <div className="hero-grid">
          <div className="intro-panel">
            <span className="section-kicker">Portfolio / Cloud Tech Computing</span>
            <p className="mini-note">Based in Indonesia. Building products and dependable systems.</p>
            <h1 className="typing-title">
              <TypingName />
            </h1>
            <p className="intro-text">
              Saya adalah fresh graduate Informatika yang nyaman bekerja di tim Agile,
              terbiasa mengatur alur kerja dengan pendekatan Kanban, dan suka membangun
              sistem yang bukan hanya jalan, tapi juga enak dipelihara dalam jangka panjang.
            </p>

            <div className="cta-row">
              <a href="#projects" className="primary-cta">
                Explore projects
              </a>
              <a href="#experience" className="ghost-cta">
                View experience
              </a>
            </div>

            <div className="stat-ribbon">
              <div>
                <span>Total projects</span>
                <strong>{projects.length}</strong>
              </div>
              <div>
                <span>Public releases</span>
                <strong>{publicProjects.length}</strong>
              </div>
              <div>
                <span>Work entries</span>
                <strong>{experiences.length}</strong>
              </div>
              <div>
                <span>Stack focus</span>
                <strong>Cloud / DevOps</strong>
              </div>
            </div>
          </div>

          <aside className="about-panel" id="about">
            <div className="about-visual">
              <div className="portrait-glow" />
              <div className="portrait-frame">
                <Image
                  src="/DSC09788.jpg"
                  alt="Portrait of Dawwi in a black suit"
                  fill
                  className="portrait-image"
                  sizes="(max-width: 1080px) 100vw, 420px"
                  priority
                />
              </div>

              <div className="floating-shot scenic-shot">
                <Image
                  src="/DSC03688_1_1.JPG"
                  alt="Dawwi at a mountain landscape"
                  fill
                  className="floating-image"
                  sizes="220px"
                />
              </div>

              <div className="floating-shot casual-shot">
                <Image
                  src="/DSC02120.jpg"
                  alt="Casual portrait of Dawwi"
                  fill
                  className="floating-image"
                  sizes="180px"
                />
              </div>
            </div>

            <div className="about-copy">
              <span className="section-kicker muted-dark">About Me</span>
              <h2>Who is Dawwi?</h2>
              <p>
                Fresh Informatics graduate dengan pengalaman memimpin tim kecil, mengoordinasikan
                task delivery, dan mengembangkan internal tools di lingkungan kerja yang
                kolaboratif. Saya menikmati kombinasi antara software engineering, deployment,
                dan system operations.
              </p>
              <p>
                Secara teknis saya terbiasa dengan React dan Next.js, Linux environment,
                containerized deployment, self-hosted infrastructure, serta monitoring stack
                untuk menjaga sistem tetap stabil dan terukur.
              </p>

              <div className="about-chips">
                <span>Agile workflow</span>
                <span>Team leadership</span>
                <span>Cloud & DevOps</span>
                <span>Self-hosted systems</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="content-section" id="experience">
        <div className="section-heading">
          <span className="section-kicker">Experience</span>
          <h2>Leadership, delivery, and practical systems thinking.</h2>
        </div>

        <div className="experience-grid">
          {experiences.length > 0 ? (
            experiences.map((experience) => (
              <ExperienceCard key={experience.documentId || experience.id} experience={experience} />
            ))
          ) : (
            <article className="experience-card empty-state">
              <h3>No published experience yet</h3>
              <p>Collection `work-experiences-Dawwi` belum memiliki entry publik.</p>
            </article>
          )}
        </div>
      </section>

      <section className="content-section" id="projects">
        <div className="section-heading">
          <span className="section-kicker">Projects</span>
          <h2>Selected public releases and private technical labs.</h2>
        </div>

        <div className="projects-layout">
          <div className="showcase-list">
            {publicProjects.length > 0 ? (
              publicProjects.map((project, index) => (
                <PublicProjectCard
                  key={project.documentId || project.id}
                  project={project}
                  index={index}
                />
              ))
            ) : (
              <article className="showcase-card empty-state">
                <div className="showcase-number">00</div>
                <div className="showcase-content">
                  <h3>No public projects yet</h3>
                  <p>Tambahkan project dengan status `public` di Strapi untuk mengisi area ini.</p>
                </div>
              </article>
            )}
          </div>

          <aside className="labs-panel">
            <div className="labs-shell">
              <span className="section-kicker muted">Private labs</span>
              <h3>Internal experiments and infrastructure work.</h3>
              <div className="labs-list">
                {privateProjects.length > 0 ? (
                  privateProjects.map((project) => (
                    <PrivateProjectCard
                      key={project.documentId || project.id}
                      project={project}
                    />
                  ))
                ) : (
                  <article className="lab-card">
                    <h4>No private entries</h4>
                    <p>Semua project yang ada saat ini sudah tampil sebagai public release.</p>
                  </article>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-copy">
          <span className="section-kicker">Footer</span>
          <h2>Designed and built by Dawwi.</h2>
          <p>Bandung, Indonesia</p>
        </div>

        <div className="footer-links">
          <a href="mailto:dawwi.rdm@gmail.com" aria-label="Email Dawwi">
            <Image
              src="/google_mail_gmail_logo_icon_159346.webp"
              alt=""
              width={18}
              height={18}
              className="footer-icon"
            />
            <span>dawwi.rdm@gmail.com</span>
          </a>
          <a href="https://www.linkedin.com/in/dawwi-rdm/" target="_blank" rel="noreferrer">
            <Image
              src="/LinkedIn_icon.svg.webp"
              alt=""
              width={18}
              height={18}
              className="footer-icon"
            />
            <span>LinkedIn</span>
          </a>
          <a href="https://github.com/DrdmRandom" target="_blank" rel="noreferrer">
            <Image
              src="/25231.webp"
              alt=""
              width={18}
              height={18}
              className="footer-icon"
            />
            <span>GitHub</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
