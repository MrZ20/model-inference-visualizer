<script lang="ts">
  import {
    PARTICLE_DPR_LIMIT,
    type ParticleFrame
  } from '$lib/visualization/particle-projection';

  export let frame: ParticleFrame | null;

  let canvas: HTMLCanvasElement;

  const drawParticleFrame = (target: HTMLCanvasElement, particleFrame: ParticleFrame) => {
    const dpr = Math.min(window.devicePixelRatio || 1, PARTICLE_DPR_LIMIT);
    const backingWidth = Math.max(1, Math.round(particleFrame.width * dpr));
    const backingHeight = Math.max(1, Math.round(particleFrame.height * dpr));
    if (target.width !== backingWidth || target.height !== backingHeight) {
      target.width = backingWidth;
      target.height = backingHeight;
    }

    target.dataset.particleChecksum = particleFrame.checksum;
    target.dataset.particleCount = String(particleFrame.particles.length);
    target.dataset.movingParticleCount = String(particleFrame.movingParticleCount);
    target.dataset.particleDpr = String(dpr);

    const context = target.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, particleFrame.width, particleFrame.height);
    context.lineCap = 'round';

    for (const particle of particleFrame.particles) {
      if (!particle.visible || particle.projectedAlpha <= 0) continue;

      context.globalAlpha = particle.projectedAlpha * 0.18;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius * 2.45, 0, Math.PI * 2);
      context.fill();

      if (particle.motion === 'traveling') {
        context.globalAlpha = particle.projectedAlpha * 0.52;
        context.strokeStyle = particle.color;
        context.lineWidth = Math.max(1, particle.radius * 0.72);
        context.beginPath();
        context.moveTo(particle.tailX, particle.tailY);
        context.lineTo(particle.x, particle.y);
        context.stroke();
      }

      context.globalAlpha = particle.projectedAlpha;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
  };

  $: if (canvas && frame) drawParticleFrame(canvas, frame);
</script>

<canvas bind:this={canvas} data-particle-field class="particle-field" aria-hidden="true"></canvas>
