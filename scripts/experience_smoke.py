"""Real Chromium verification on isolated data; never edits the user's restaurant."""
import os,json,subprocess,tempfile,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]; ORIGIN='http://localhost:3105'
with tempfile.TemporaryDirectory(prefix='resuto-experience-') as tmp:
 env={**os.environ,'PORT':'3105','APP_ORIGIN':ORIGIN,'DB_PATH':str(Path(tmp)/'test.sqlite'),'MANAGER_PASSWORD':'experience-manager','KITCHEN_PASSWORD':'experience-kitchen','PAYMENT_MODE':'test'};env.pop('GEMINI_API_KEY',None)
 with open(Path(tmp)/'server.log','w') as log:
  proc=subprocess.Popen(['node','server.js'],cwd=ROOT,env=env,stdout=log,stderr=log)
  try:
   for _ in range(60):
    try:urllib.request.urlopen(ORIGIN,timeout=1);break
    except OSError:time.sleep(.2)
   with sync_playwright() as p:
    browser=p.chromium.launch(headless=True);errors=[];art=ROOT/'artifacts';art.mkdir(exist_ok=True)
    manager=browser.new_page(viewport={'width':1440,'height':1000});guest=browser.new_page(viewport={'width':1440,'height':1000})
    for page in [manager,guest]:page.on('pageerror',lambda err:errors.append(str(err)));page.set_default_timeout(10000)
    manager.on('dialog',lambda d:d.accept())
    manager.goto(ORIGIN+'/manager/setup');manager.get_by_label('Password',exact=True).fill('experience-manager');manager.get_by_role('button',name='Sign in',exact=False).click();expect(manager.locator('.setup-card')).to_be_visible()
    manager.locator('[data-step="1"]').click();manager.locator('[name="name"]').fill('Resuto Demo Restaurant');manager.locator('[name="cuisine"]').fill('Mediterranean');manager.locator('#brand-upload').set_input_files(str(ROOT/'public/assets/resuto-arabic-logo.png'));expect(manager.locator('.setup-logo')).to_be_visible();manager.screenshot(path=str(art/'experience-onboarding-basics.png'),full_page=True);manager.get_by_role('button',name='Save & continue').click();expect(manager.locator('.setup-card h2')).to_have_text('First branch');manager.locator('[name="name"]').fill('Downtown Branch');manager.get_by_role('button',name='Save & continue').click();expect(manager.locator('.setup-card h2')).to_have_text('Your way of working');manager.locator('[name="mode"][value="native"]').check();manager.get_by_role('button',name='Save & continue').click();expect(manager.locator('.setup-card h2')).to_have_text('Build your experience');saved_setup=manager.request.get(ORIGIN+'/api/setup').json();assert saved_setup['profile']['name']=='Resuto Demo Restaurant';assert saved_setup['branch']['name']=='Downtown Branch';assert saved_setup['profile']['logo'].startswith('data:image/png');manager.screenshot(path=str(art/'experience-onboarding.png'),full_page=True)
    manager.goto(ORIGIN+'/manager/floor-editor');manager.locator('[data-tool="template"]').click();expect(manager.locator('#studio-canvas .svg-table')).to_have_count(12);manager.locator('[data-tool="save"]').click();expect(manager.locator('#draft-status')).to_contain_text('All changes saved');manager.screenshot(path=str(art/'experience-floor-2d.png'),full_page=True)
    manager.locator('[data-tool="layer"]').filter(has_text='T1').first.click();manager.locator('[data-tool="lock"]').click();manager.locator('[data-tool="nudge-right"]').click();manager.locator('[data-tool="lock"]').click();manager.locator('[data-tool="undo"]').click();manager.locator('[data-tool="undo"]').click();manager.locator('[data-tool="discard"]').click();manager.locator('#floor-autosave').check();manager.locator('[data-tool="layer"]').filter(has_text='T1').first.click();manager.locator('[data-tool="nudge-right"]').click();expect(manager.locator('#draft-status')).to_contain_text('All changes saved');manager.locator('#floor-autosave').uncheck();manager.locator('[data-tool="preview"]').click();expect(manager.locator('.floor-projection')).to_be_visible();manager.screenshot(path=str(art/'experience-floor-25d.png'),full_page=True);manager.locator('dialog>button').click()
    guest.goto(ORIGIN+'/reserve');expect(guest.locator('.booking-map')).to_be_visible();guest.locator('[data-filter="Window side"]').click();expect(guest.locator('.table-list')).to_contain_text('T6');guest.locator('.table-list button').click();expect(guest.locator('.booking-detail')).to_contain_text('Window side');guest.screenshot(path=str(art/'experience-reservation.png'),full_page=True)
    guest.locator('[name="name"]').fill('Test Guest');guest.locator('[name="contact"]').fill('fictional');guest.get_by_role('button',name='Confirm demo reservation').click();expect(guest.locator('.booking-confirm')).to_contain_text('Reservation confirmed');guest.screenshot(path=str(art/'experience-confirmation.png'),full_page=True)
    guest.goto(ORIGIN+'/reserve');guest.locator('#table-ai input').fill('عايز مكان هادي بعيد عن الباب');guest.locator('#table-ai button').click();expect(guest.locator('.table-list')).to_contain_text('✧ T9')
    for width in [375,430,768,1440]:
     guest.set_viewport_size({'width':width,'height':900})
     for route in ['/reserve','/pricing','/']:
      guest.goto(ORIGIN+route);guest.wait_for_load_state('networkidle');assert guest.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Overflow {route} {width}'
      if width in [375,1440]:guest.screenshot(path=str(art/('experience-'+('landing' if route=='/' else route[1:])+'-'+str(width)+'.png')),full_page=True)
    guest.goto(ORIGIN+'/pricing');guest.locator('[data-billing="yearly"]').click();expect(guest.locator('.price-card').nth(1)).to_contain_text('14,990');guest.locator('a[href="#sales"]').click();expect(guest.locator('#sales-form')).to_be_visible()
    guest.locator('#sales-form [name="restaurant"]').fill('Example Group');guest.locator('#sales-form [name="email"]').fill('demo@example.test');guest.locator('#sales-form [name="requirements"]').fill('Three branches');guest.locator('#sales-form button').click();expect(guest.locator('#sales-form')).to_contain_text('Request received');assert len(manager.request.get(ORIGIN+'/api/setup').json()['salesInquiries'])==1
    print('Performance navigation timings (desktop):',guest.evaluate('JSON.stringify(performance.getEntriesByType("navigation").map(n=>({dom:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd)})))'),flush=True)
    guest.evaluate("localStorage.setItem('resuto-language','ar')")
    for route in ['/reserve','/pricing','/']:
     for width in [375,430,1440]:
      guest.set_viewport_size({'width':width,'height':900});guest.goto(ORIGIN+route);guest.wait_for_load_state('networkidle');expect(guest.locator('html')).to_have_attribute('dir','rtl');assert guest.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Arabic overflow {route} {width}'
      if width==375:guest.screenshot(path=str(art/('experience-ar-'+('landing' if route=='/' else route[1:])+'.png')),full_page=True)
    touch=browser.new_page(viewport={'width':375,'height':844},is_mobile=True,has_touch=True);touch.goto(ORIGIN+'/reserve');expect(touch.locator('.floor-projection')).to_be_visible();touch.locator('.booking-map').scroll_into_view_if_needed();box=touch.locator('.booking-map').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2;cdp=touch.context.new_cdp_session(touch);before=touch.locator('.floor-projection').get_attribute('style');cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx-30,'y':cy,'id':1},{'x':cx+30,'y':cy,'id':2}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx-65,'y':cy,'id':1},{'x':cx+65,'y':cy,'id':2}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert touch.locator('.floor-projection').get_attribute('style')!=before;touch.close()
    manager.evaluate("localStorage.setItem('resuto-language','ar')")
    for route in ['/manager/setup','/manager/floor-editor']:
     for width in [375,430,1440]:
      manager.set_viewport_size({'width':width,'height':900});manager.goto(ORIGIN+route);manager.wait_for_load_state('networkidle');assert manager.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Manager Arabic overflow {route} {width}'
     manager.screenshot(path=str(art/('experience-ar-'+route.split('/')[-1]+'.png')),full_page=True)
    assert not errors,errors
    print('PASS: guided setup, 12-table save, 2.5D preview, T6 booking, Arabic T9 recommendation, EN/AR responsive 375/430/768/1440, pricing, screenshots; no page errors',flush=True)
    browser.close()
  finally:proc.terminate();proc.wait(timeout=10)
