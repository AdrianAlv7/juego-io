export function GameLogo() {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="relative">
        <h1 
          className="text-5xl tracking-tight italic"
          style={{
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow: `
              3px 3px 0px #FF6B35,
              6px 6px 0px rgba(0, 0, 0, 0.3),
              0 0 20px rgba(255, 107, 53, 0.4)
            `,
            letterSpacing: '-0.02em'
          }}
        >
          Deliver<span style={{ color: '#FFB800' }}>.io</span>
        </h1>
      </div>
    </div>
  );
}
