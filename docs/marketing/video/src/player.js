// Small player for the film page.
//   ?format=square   1080 x 1080 layout (the stage is scaled, captions move below it)
//   ?t=12.5          stand still at that second (for looking at one moment)
// The render script calls window.seek(seconds) for every frame.
const q = new URLSearchParams(location.search)
if (q.get('format') === 'square') document.documentElement.dataset.format = 'square'
window.DURATION = 48

async function start() {
  // the end card is the launch sting in the three modes, stacked: put the SVGs into the page so they run on the
  // film's clock; each gets its own prefix so their styles do not mix
  for (const holder of document.querySelectorAll('.endlogo')) {
    const mode = holder.className.match(/el-(\w+)/)[1]
    try {
      holder.innerHTML = (await (await fetch(holder.dataset.src)).text()).replace(/\bst\b/g, `st${mode}`)
    } catch {
      holder.innerHTML = `<img src="../../../../resources/brand/logo/reqochet-logo-on-${mode}.svg" style="position:absolute;left:24%;width:52%;top:39.3%">`
    }
  }
  await document.fonts.ready
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
  const anims = document.getAnimations()
  window.seek = (t) => {
    for (const a of anims) {
      a.pause()
      a.currentTime = t * 1000
    }
  }
  if (q.has('t')) window.seek(Number(q.get('t')))
  window.ready = true
}
start()
