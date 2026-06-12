from nicegui import app, ui
from typing import Optional

# import locus.src.auth
import src.theme
import src.home
import time

# @ui.page('/login')
# def login() -> Optional[RedirectResponse]:
#     def try_login() -> None:  # local function to avoid passing username and password as arguments
#         if passwords.get(username.value) == password.value:
#             app.storage.user.update({'username': username.value, 'authenticated': True})
#             ui.navigate.to(app.storage.user.get('referrer_path', '/'))  # go back to where the user wanted to go
#         else:
#             ui.notify('Wrong username or password', color='negative')

#     if app.storage.user.get('authenticated', False):
#         return RedirectResponse('/')
#     with ui.card().classes('absolute-center'):
#         username = ui.input('Username').on('keydown.enter', try_login)
#         password = ui.input('Password', password=True, password_toggle_button=True).on('keydown.enter', try_login)
#         ui.button('Log in', on_click=try_login)
#     return None


@ui.page('/')
async def index_page() -> None:
    with src.theme.frame('Homepage'):
        src.home.content()
        # await src.home.history()

ui.run(storage_secret='THIS_NEEDS_TO_BE_CHANGED')