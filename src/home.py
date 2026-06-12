from nicegui import app, ui
import time
import asyncio

def content() -> None:
    with ui.leaflet(center=(51.505, -0.090), zoom=3) as m:
        m.clear_layers()
        m.tile_layer(
            url_template=r'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            options={
                'maxZoom': 17
            },
        )

async def history() -> None:
    async def check():
        try:
            if await ui.run_javascript('window.pageYOffset >= document.body.offsetHeight - 2 * window.innerHeight'):
                ui.timeline_entry('A tracked visit.',
                                title=f'Added {time.time()}',
                                subtitle='May 07, 2021')
        except TimeoutError:
            pass  # the client might have disconnected

    with ui.timeline(side='right'):
        await ui.context.client.connected()
        ui.timer(0.5, check)
