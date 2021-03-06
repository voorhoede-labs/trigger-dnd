import {
  app,
  Menu,
  ipcMain,
  systemPreferences,
  globalShortcut,
  nativeTheme,
} from 'electron'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import { enableLiveReload } from 'electron-compile'
import log from 'electron-log'
import AutoLaunch from 'auto-launch'
import createMainWindow, {
  activate as activateMainWindow,
  show as showMainWindow,
  hide as hideMainWindow,
  openPreferences,
} from './main/main-window'
import createTray from './main/tray'
import { activate } from './main/main-window'
import * as events from './events'
import status from './main/status'
import { loadPersistentData } from './main/persistent-data'
import serviceInputGoogleCalendar, {
  getCalendarEvents,
} from './services-input/google-calendar'
import triggerSlack from './services/slack'
import triggerSystemDnd from './services/system-dnd'
import luxafor from './services/luxafor'
import updateElectronApp from 'update-electron-app'
import './main/version'

updateElectronApp({
  repo: 'voorhoede-labs/trigger-dnd',
  logger: log,
})

const isDevMode = process.execPath.match(/[\\/]electron/)
const contextMenu = Menu.buildFromTemplate([
  {
    label: 'Start DnD',
    id: 'dnd-start',
    accelerator: 'Control+Alt+Meta+D',
    click() {
      setDndActive()
    },
  },
  {
    label: 'End DnD',
    id: 'dnd-end',
    enabled: false,
    click() {
      setDndDeactive()
    },
  },
  { type: 'separator' },
  {
    label: 'Open Trigger DnD',
    accelerator: 'Shift+Control+Alt+Meta+D',
    click() {
      showMainWindow(isDevMode)
    },
  },
  {
    label: 'Preferences',
    accelerator: 'Command+,',
    click() {
      openPreferences(isDevMode)
    },
  },
  {
    label: 'Reload Calendar Events',
    accelerator: 'Command+R',
    click() {
      getCalendarEvents()
    },
  },
  { type: 'separator' },
  {
    label: 'Quit TriggerDnD',
    accelerator: 'Command+Q',
    selector: 'terminate:',
  },
])

systemPreferences.subscribeNotification(
  'AppleInterfaceThemeChangedNotification',
  () => {
    status.dark = !nativeTheme.shouldUseDarkColors
  },
)

status.on('dnd', function (dnd) {
  contextMenu.getMenuItemById('dnd-start').enabled = !dnd
  contextMenu.getMenuItemById('dnd-end').enabled = dnd
})

const autoLauncher = new AutoLaunch({ name: 'Trigger DnD' })
if (status.autoStart) {
  autoLauncher
    .isEnabled()
    .then((enabled) => {
      if (enabled === false) {
        autoLauncher.enable().catch((err) => {
          console.log(err.message)
          alert('Could not enable Open at startup')
          status.autoStart = false
        })
      }
    })
    .catch((err) => console.log(err.message))
}

status.on('autoStart', (autoStart) => {
  if (autoStart) {
    autoLauncher
      .isEnabled()
      .then((enabled) => {
        if (enabled === false) {
          autoLauncher.enable().catch((err) => {
            console.log(err.message)
            alert('Could not enable Open at startup')
            status.autoStart = false
          })
        }
      })
      .catch((err) => console.log(err.message))
  } else {
    autoLauncher.disable().catch((err) => {
      console.log(err.message)
      alert('Could not disable Open at startup')
      status.autoStart = true
    })
  }
})

if (isDevMode) enableLiveReload()

app.on('ready', () => {
  // Hide dock icon, not needed for tray application
  if (!isDevMode) {
    app.dock.hide()
  }

  const tray = createTray(contextMenu)
  createMainWindow(isDevMode)
  tray.on('right-click', toggleDnd)

  globalShortcut.register('Control+Alt+Meta+D', () => {
    if (status.dnd) {
      if (status.cancelable) {
        setDndDeactive()
      }
    } else {
      if (!status.cancelable) {
        setDndActive()
      }
    }
  })
  globalShortcut.register('Shift+Control+Alt+Meta+D', () => {
    showMainWindow(isDevMode)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => activateMainWindow(isDevMode))

ipcMain.on('preferences', (event, eventName, ...args) => {
  switch (eventName) {
    case events.REQUEST_STATUS:
      return status.sendCurrentStatus(event.sender, events.CURRENT_STATUS)
    case events.DND_ACTIVATE:
      return setDndActive()
    case events.DND_DEACTIVATE:
      return setDndDeactive()
    case events.DND_TOGGLE:
      return toggleDnd()
    case events.SLACK_ENABLED_TOGGLE:
      return toggleSlackEnabled()
    case events.OS_ENABLED_TOGGLE:
      return toggleOsEnabled()
    case events.STATUS_ACTIVATE:
      return triggerStatus()
    case events.MSG_CHANGE:
      return setMsg(...args)
    case events.DURATION_CHANGE:
      return setDuration(...args)
    case events.SLACK_TOKEN_CHANGE:
      return setSlackToken(...args)
    case events.REQUEST_STATUS_PROP_CHANGE:
      return changeStatusProperty(...args)
    case events.RELOAD_EVENTS:
      return getCalendarEvents()
  }
})

function setDndActive() {
  status.startStatus({ dnd: true })
}

function setDndDeactive() {
  status.cancelStatus()
}

function toggleDnd() {
  status.dnd ? status.cancelStatus() : status.startStatus({ dnd: true })
}

function toggleSlackEnabled() {
  status.slackEnabled = !status.slackEnabled
}

function toggleOsEnabled() {
  status.osEnabled = !status.osEnabled
}

function triggerStatus() {
  status.startStatus()
}

function setMsg(msg) {
  status.userMsg = msg
}

function setDuration(duration) {
  status.duration = duration
}

function setSlackToken(token) {
  status.slackToken = token
}

function changeStatusProperty(property, value) {
  status[property] = value
}

loadPersistentData().then(() => {
  triggerSlack()
  triggerSystemDnd()

  luxafor()
  serviceInputGoogleCalendar()
})
