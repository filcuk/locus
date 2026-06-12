from nicegui import app, ui


def menu() -> None:
    ui.label(f'Hello {app.storage.user["username"]}!').classes('text-1xl')
    ui.link('Home', '/').classes(replace='text-white')
    ui.link('A', '/a').classes(replace='text-white')
    ui.link('B', '/b').classes(replace='text-white')
    ui.link('C', '/c').classes(replace='text-white')
    
    ui.button(on_click=lambda: (app.storage.user.clear(), ui.navigate.to('/login')), icon='logout').props('outline round')

def menuMobile() -> None:
    with ui.element('q-fab').props('icon=navigation color=green'):
        ui.element('q-fab-action').props('icon=train color=green-5') \
            .on('click', lambda: ui.notify('train'))
        ui.element('q-fab-action').props('icon=sailing color=green-5') \
            .on('click', lambda: ui.notify('boat'))
        ui.element('q-fab-action').props('icon=rocket color=green-5') \
            .on('click', lambda: ui.notify('rocket'))