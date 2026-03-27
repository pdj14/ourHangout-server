const app = document.getElementById('app')

const COPY = {
  ko: {
    tab_dashboard_title: '개요',
    tab_dashboard_copy: 'DB 요약, 가족 연결, 저장공간 경고를 봅니다.',
    tab_users_title: '사용자',
    tab_users_copy: '계정 검색, 프로필 수정, 세션 제어를 처리합니다.',
    tab_rooms_title: '메시지',
    tab_rooms_copy: '아이들 메시지를 확인하고 test 데이터를 정리합니다.',
    tab_storage_title: '저장공간',
    tab_storage_copy: '자산, 고아 파일, 디스크 사용량을 점검합니다.',
    signed_in: '로그인 계정',
    role_label: '권한',
    refresh_current_tab: '현재 탭 새로고침',
    log_out: '로그아웃',
    console_areas: '콘솔 영역',
    hero_title: 'ourHangout 부모 관리 화면',
    hero_body: 'DB 내용 확인, 아이들 대화 검토, test 메시지 정리, 저장공간 관리까지 한 화면에서 처리합니다.',
    login_kicker: '부모/마스터 전용',
    login_title: 'Guardian Console',
    login_body: 'Google 로그인으로 들어오세요. 기본 master 계정은 {masterEmail} 입니다.',
    google_signin_label: 'Google 로그인',
    google_missing_config: '이 서버에는 Google Web Client ID가 아직 설정되지 않았습니다.',
    google_current_label: '현재 브라우저 Google 계정',
    google_current_body: '지금 브라우저에 로그인된 Google 계정으로 바로 계속합니다.',
    google_switch_label: '다른 Google 계정 선택',
    google_switch_body: '브라우저 기본 계정이 아니라도 다른 Google 계정을 직접 입력해서 로그인할 수 있습니다.',
    google_switch_button: '다른 계정으로 로그인',
    sign_in: '로그인',
    signing_in: '로그인 중...',
    footer_note:
      '이 페이지는 /v1/auth/google 과 /v1/guardian/* 를 사용합니다. 부모 계정과 master 계정만 접근할 수 있습니다.',
    dashboard_loading_title: '개요',
    dashboard_loading_body: '서버에서 요약 정보를 불러오는 중입니다.',
    dashboard_loading_state: 'DB 요약, 가족 연결, 저장공간 경고를 읽는 중입니다.',
    dashboard_no_data: '대시보드 데이터가 없습니다.',
    snapshot_title: '운영 현황',
    snapshot_body: '계정, 방, 메시지, 저장공간 상태를 빠르게 확인합니다.',
    family_links_title: '부모-자녀 연결',
    family_links_body: '아이들 메시지 검토 범위를 좁히는 기준으로 사용합니다.',
    no_family_links: '활성 parent-child 연결이 없습니다.',
    storage_alerts_title: '저장공간 경고',
    storage_alerts_body: '고아 파일과 추적 누락 파일을 함께 봅니다.',
    no_orphan_files: '현재 감지된 고아 파일이 없습니다.',
    top_storage_users_title: '상위 저장공간 사용자',
    top_storage_users_body: '완료된 업로드 자산을 많이 가진 계정부터 보여줍니다.',
    no_upload_assets: '완료된 업로드 자산이 아직 없습니다.',
    kpi_users: '사용자',
    kpi_rooms: '방',
    kpi_messages: '메시지',
    kpi_storage: '저장공간',
    kpi_users_sub: '부모 {parents} / 자녀 {children}',
    kpi_rooms_sub: '1:1 {direct} / 그룹 {group}',
    kpi_messages_sub: '텍스트 {text} / 미디어 {media}',
    kpi_storage_sub: '실디스크 {bytes}',
    badge_parent_child: '부모-자녀 {count}',
    badge_open_reports: '열린 신고 {count}',
    badge_test_like: 'test 유사 {count}',
    role_parent: '부모',
    role_user: '사용자',
    room_type_direct: '1:1',
    room_type_group: '그룹',
    asset_status_completed: '완료',
    asset_status_pending: '대기',
    asset_status_failed: '실패',
    message_kind_text: '텍스트',
    message_kind_system: '시스템',
    message_kind_image: '이미지',
    message_kind_video: '비디오',
    asset_kind_avatar: '아바타',
    delivery_sent: '전송됨',
    delivery_delivered: '전달됨',
    delivery_read: '읽음',
    users_title: '사용자 관리',
    users_body: '표시 이름, 상태 메시지, 전화번호, locale, 권한을 수정하고 세션을 종료할 수 있습니다.',
    search_label: '검색',
    search_users_placeholder: '이메일, 표시 이름, 전화번호',
    role_filter_label: '권한',
    limit_label: '개수',
    load_users: '사용자 조회',
    refresh: '새로고침',
    table_user: '사용자',
    table_role: '권한',
    table_activity: '활동',
    table_storage: '저장공간',
    table_meta: '메타',
    table_actions: '동작',
    no_users_matched: '조건에 맞는 사용자가 없습니다.',
    no_phone: '전화번호 없음',
    no_status: '상태 메시지 없음',
    location_sharing_on: '위치 공유 ON',
    location_sharing_off: '위치 공유 OFF',
    latest_location_at: '최근 위치 {time}',
    no_location_yet: '아직 위치 기록이 없어요.',
    view_location: '위치 보기',
    precise_refresh: '정확히 새로고침',
    open_map: '지도 열기',
    flash_location_disabled: '이 계정은 위치 공유가 꺼져 있어요.',
    flash_location_missing: '아직 저장된 위치가 없어요.',
    flash_precise_refresh_requested: '정확한 위치 새로고침을 요청했어요. 만료 시각: {time}',
    edit: '수정',
    revoke_sessions: '세션 종료',
    rooms_count: '{count}개 방',
    messages_count: '{count}개 메시지',
    family_links_count: '{count}개 가족 연결',
    edit_user_title: '{name} 수정',
    edit_user_body: '저장하면 users 테이블에 바로 반영됩니다.',
    close: '닫기',
    display_name_label: '표시 이름',
    phone_label: '전화번호 E.164',
    locale_label: '언어 태그',
    status_message_label: '상태 메시지',
    save: '저장',
    cancel: '취소',
    message_review_title: '메시지 검토',
    message_review_body: '부모가 방 기록을 검토하고 아이들 메시지와 test 데이터를 정리합니다.',
    room_type_label: '방 유형',
    all_option: '전체',
    all_users: '전체 사용자',
    child_filter_label: '자녀 필터',
    all_linked_children: '연결된 자녀 전체',
    room_search_placeholder: '방 제목, 멤버 이름 또는 이메일',
    load_rooms: '방 조회',
    bulk_cleanup_title: 'test 메시지 일괄 정리',
    bulk_cleanup_body: '기본 검색어는 test 입니다. 먼저 미리보기 후 실제 삭제를 실행하세요.',
    search_text_label: '검색어',
    room_label: '방',
    all_rooms: '전체 방',
    sender_label: '보낸 사람',
    before_label: '이전 시각',
    message_kinds_label: '메시지 종류',
    preview: '미리보기',
    delete_matches: '조건 일괄 삭제',
    preview_result: '미리보기 결과',
    preview_only: '미리보기만 수행했습니다. 아직 삭제하지 않았습니다.',
    messages_deleted_count: '{count}개 메시지를 삭제했습니다.',
    no_bulk_matches: '조건에 맞는 메시지가 없습니다.',
    rooms_title: '방 목록',
    rooms_body: '메시지 기록을 확인할 방을 선택하세요.',
    no_rooms_matched: '조건에 맞는 방이 없습니다.',
    no_messages_yet: '아직 메시지가 없습니다.',
    select_room: '방을 선택하세요',
    select_room_body: '왼쪽에서 방을 선택하면 메시지를 불러옵니다.',
    refresh_messages: '메시지 새로고침',
    no_messages_loaded: '이 방에서 불러온 메시지가 없습니다.',
    no_text_payload: '텍스트 내용 없음',
    load_older_messages: '이전 메시지 더 보기',
    storage_title: '저장공간 관리',
    storage_body: '추적 중인 업로드, 미참조 자산, 디스크에만 있는 파일을 함께 검토합니다.',
    delete_orphan_files: '고아 파일 정리',
    kpi_tracked: '추적 자산',
    kpi_tracked_sub: '완료 {completed} / 대기 {pending}',
    kpi_tracked_bytes: '추적 용량',
    kpi_orphans: '고아 파일',
    kpi_orphans_sub: '추적 누락 {count}',
    kpi_failed_assets: '실패 자산',
    kpi_failed_assets_sub: 'failed 상태 행',
    by_kind_title: '종류별',
    top_users_title: '상위 사용자',
    loading_storage_overview: '저장공간 개요를 불러오는 중입니다.',
    owner_label: '소유자',
    all_owners: '전체 소유자',
    status_label: '상태',
    unreferenced_only: '미참조만 보기',
    load_assets: '자산 조회',
    table_owner: '소유자',
    table_asset: '자산',
    table_references: '참조',
    table_file_state: '파일 상태',
    table_updated: '갱신 시각',
    no_assets_matched: '조건에 맞는 자산이 없습니다.',
    avatar_linked: '아바타 연결됨',
    avatar_not_linked: '아바타 연결 없음',
    room_message_refs: '방 메시지 참조 {count}',
    members_count: '{count}명',
    assets_count: '{count}개 자산',
    matches_count: '{count}건',
    file_exists: '파일 존재',
    file_missing: '파일 없음',
    delete: '삭제',
    google_missing_id_token: 'Google 로그인에서 ID 토큰을 받지 못했습니다.',
    google_signin_failed: 'Google 로그인에 실패했습니다.',
    google_redirect_failed: 'Google 계정 선택 로그인 처리에 실패했습니다.',
    google_redirect_state_invalid: 'Google 로그인 상태값 검증에 실패했습니다.',
    google_redirect_nonce_invalid: 'Google 로그인 nonce 검증에 실패했습니다.',
    confirm_revoke_sessions: '이 사용자의 모든 refresh 세션을 종료할까요?',
    flash_sessions_revoked: '사용자 세션을 종료했습니다.',
    flash_no_active_sessions: '종료할 활성 세션이 없었습니다.',
    confirm_delete_message: '이 메시지를 삭제할까요?',
    flash_message_deleted: '메시지를 삭제했습니다.',
    asset_still_referenced: '이 자산은 room_messages 에서 참조 중입니다. 관련 메시지를 먼저 삭제하세요.',
    confirm_clear_avatar: '이 자산은 아바타로 연결되어 있습니다. 아바타를 비우고 계속할까요?',
    confirm_delete_asset: '이 자산을 삭제할까요?',
    flash_asset_deleted: '자산을 삭제했습니다.',
    confirm_delete_release: '이 APK 버전을 배포 목록과 서버 디스크에서 삭제할까요?',
    flash_release_deleted: '버전 {version}을 삭제했습니다.',
    confirm_delete_orphans: 'media_assets 에 없는 디스크 파일을 삭제할까요?',
    flash_orphans_deleted: '{count}개 파일을 삭제했고 {bytes} 를 확보했습니다.',
    action_failed: '작업에 실패했습니다.',
    flash_user_updated: '사용자 정보를 저장했습니다.',
    confirm_delete_matches: '조건에 맞는 메시지를 실제로 삭제할까요?',
    session_validation_failed: '세션 확인에 실패했습니다. 다시 로그인하세요.',
    no_data: '데이터 없음'
    ,
    empty_content: '내용 없음'
  },
  en: {
    tab_dashboard_title: 'Overview',
    tab_dashboard_copy: 'DB summary, family links, and storage warnings.',
    tab_users_title: 'Users',
    tab_users_copy: 'Account search, profile updates, and session control.',
    tab_rooms_title: 'Messages',
    tab_rooms_copy: 'Parent review for children messages and test cleanup.',
    tab_storage_title: 'Storage',
    tab_storage_copy: 'Assets, orphan files, and disk usage checks.',
    signed_in: 'Signed In',
    role_label: 'Role',
    refresh_current_tab: 'Refresh Current Tab',
    log_out: 'Log Out',
    console_areas: 'Console Areas',
    hero_title: 'Parent operations for ourHangout',
    hero_body: 'Review DB content, inspect children message history, clean up test messages, and manage storage from one place.',
    login_kicker: 'Parent or Master Only',
    login_title: 'Guardian Console',
    login_body: 'Use Google sign-in. The default master account is {masterEmail}.',
    login_fixed_body: 'Sign in with the configured Guardian Console ID and password.',
    login_id_label: 'ID',
    login_password_label: 'Password',
    login_password_hint: 'Only the configured Guardian Console credentials can open this page.',
    login_button: 'Sign In',
    google_signin_label: 'Google Sign-In',
    google_missing_config: 'Google Web Client ID is not configured on this server yet.',
    google_current_label: 'Current browser Google account',
    google_current_body: 'Continue with the Google account already signed into this browser.',
    google_switch_label: 'Choose another Google account',
    google_switch_body: 'Use a different Google account even if it is not the browser default account.',
    google_switch_button: 'Sign in with another account',
    sign_in: 'Sign In',
    signing_in: 'Signing in...',
    footer_note:
      'This page uses /v1/auth/google and /v1/guardian/*. Access is restricted to parent and configured master accounts.',
    footer_note_credentials:
      'This page now uses /v1/guardian/auth/login and only the configured fixed credentials are accepted.',
    dashboard_loading_title: 'Overview',
    dashboard_loading_body: 'Loading summary data from the server.',
    dashboard_loading_state: 'Reading DB summary, family links, and storage warnings.',
    dashboard_no_data: 'No dashboard data available.',
    snapshot_title: 'Operational Snapshot',
    snapshot_body: 'Quick status across accounts, rooms, messages, and storage.',
    family_links_title: 'Family Links',
    family_links_body: 'Use active parent-child links to narrow message review to children.',
    no_family_links: 'No active parent-child links were found.',
    storage_alerts_title: 'Storage Alerts',
    storage_alerts_body: 'Review orphan files and missing tracked uploads together.',
    no_orphan_files: 'No orphan files are currently detected.',
    top_storage_users_title: 'Top Storage Users',
    top_storage_users_body: 'Largest completed media owners first.',
    no_upload_assets: 'No completed upload assets yet.',
    kpi_users: 'Users',
    kpi_rooms: 'Rooms',
    kpi_messages: 'Messages',
    kpi_storage: 'Storage',
    kpi_users_sub: 'Parent {parents} / Child {children}',
    kpi_rooms_sub: 'Direct {direct} / Group {group}',
    kpi_messages_sub: 'Text {text} / Media {media}',
    kpi_storage_sub: 'Disk {bytes}',
    badge_parent_child: 'Parent-child {count}',
    badge_open_reports: 'Open reports {count}',
    badge_test_like: 'Test-like {count}',
    role_parent: 'Parent',
    role_user: 'User',
    room_type_direct: 'Direct',
    room_type_group: 'Group',
    asset_status_completed: 'Completed',
    asset_status_pending: 'Pending',
    asset_status_failed: 'Failed',
    message_kind_text: 'Text',
    message_kind_system: 'System',
    message_kind_image: 'Image',
    message_kind_video: 'Video',
    asset_kind_avatar: 'Avatar',
    delivery_sent: 'Sent',
    delivery_delivered: 'Delivered',
    delivery_read: 'Read',
    users_title: 'User Management',
    users_body: 'Update display name, status, phone, locale, and role, then revoke sessions when needed.',
    search_label: 'Search',
    search_users_placeholder: 'email, display name, phone',
    role_filter_label: 'Role',
    limit_label: 'Limit',
    load_users: 'Load Users',
    refresh: 'Refresh',
    table_user: 'User',
    table_role: 'Role',
    table_activity: 'Activity',
    table_storage: 'Storage',
    table_meta: 'Meta',
    table_actions: 'Actions',
    no_users_matched: 'No users matched this filter.',
    no_phone: 'No phone set',
    no_status: 'No status message',
    location_sharing_on: 'Location ON',
    location_sharing_off: 'Location OFF',
    latest_location_at: 'Last location {time}',
    no_location_yet: 'No location yet.',
    view_location: 'View location',
    precise_refresh: 'Precise refresh',
    open_map: 'Open map',
    flash_location_disabled: 'Location sharing is disabled for this account.',
    flash_location_missing: 'No location captured yet.',
    flash_precise_refresh_requested: 'Precise refresh requested. Expires at {time}',
    edit: 'Edit',
    revoke_sessions: 'Revoke Sessions',
    rooms_count: '{count} rooms',
    messages_count: '{count} messages',
    family_links_count: '{count} family links',
    edit_user_title: 'Edit {name}',
    edit_user_body: 'Save writes directly to the users table.',
    close: 'Close',
    display_name_label: 'Display Name',
    phone_label: 'Phone E.164',
    locale_label: 'Locale',
    status_message_label: 'Status Message',
    save: 'Save',
    cancel: 'Cancel',
    message_review_title: 'Message Review',
    message_review_body: 'Parents can review room history, inspect children conversations, and clean up test data.',
    room_type_label: 'Room Type',
    all_option: 'All',
    all_users: 'All users',
    child_filter_label: 'Child Filter',
    all_linked_children: 'All linked children',
    room_search_placeholder: 'room title, member name, or email',
    load_rooms: 'Load Rooms',
    bulk_cleanup_title: 'Bulk Test Message Cleanup',
    bulk_cleanup_body: 'Default search is set to the word "test". Preview first, then run delete only after confirmation.',
    search_text_label: 'Search Text',
    room_label: 'Room',
    all_rooms: 'All rooms',
    sender_label: 'Sender',
    before_label: 'Before',
    message_kinds_label: 'Message Kinds',
    preview: 'Preview',
    delete_matches: 'Delete Matches',
    preview_result: 'Preview Result',
    preview_only: 'Preview only. No delete has been executed yet.',
    messages_deleted_count: '{count} messages were deleted.',
    no_bulk_matches: 'No messages matched the bulk filter.',
    rooms_title: 'Rooms',
    rooms_body: 'Choose a room to inspect message history.',
    no_rooms_matched: 'No rooms matched this filter.',
    no_messages_yet: 'No messages yet.',
    select_room: 'Select a room',
    select_room_body: 'Select a room on the left to load messages.',
    refresh_messages: 'Refresh Messages',
    no_messages_loaded: 'No messages loaded for this room.',
    no_text_payload: 'No text payload',
    load_older_messages: 'Load Older Messages',
    storage_title: 'Storage Management',
    storage_body: 'Review tracked uploads, unreferenced assets, and disk-only files together.',
    delete_orphan_files: 'Delete Orphan Files',
    kpi_tracked: 'Tracked',
    kpi_tracked_sub: 'Completed {completed} / Pending {pending}',
    kpi_tracked_bytes: 'Tracked Bytes',
    kpi_orphans: 'Orphans',
    kpi_orphans_sub: 'Missing tracked {count}',
    kpi_failed_assets: 'Failed Assets',
    kpi_failed_assets_sub: 'Rows with failed status',
    by_kind_title: 'By Kind',
    top_users_title: 'Top Users',
    loading_storage_overview: 'Loading storage overview.',
    owner_label: 'Owner',
    all_owners: 'All owners',
    status_label: 'Status',
    unreferenced_only: 'unreferenced only',
    load_assets: 'Load Assets',
    table_owner: 'Owner',
    table_asset: 'Asset',
    table_references: 'References',
    table_file_state: 'File State',
    table_updated: 'Updated',
    no_assets_matched: 'No assets matched this filter.',
    avatar_linked: 'Avatar linked',
    avatar_not_linked: 'No avatar link',
    room_message_refs: 'Room message refs {count}',
    members_count: '{count} members',
    assets_count: '{count} assets',
    matches_count: '{count} matches',
    file_exists: 'File exists',
    file_missing: 'File missing',
    delete: 'Delete',
    google_missing_id_token: 'Google sign-in did not return an ID token.',
    google_signin_failed: 'Google sign-in failed.',
    google_redirect_failed: 'Google account chooser sign-in failed.',
    google_redirect_state_invalid: 'Google sign-in state validation failed.',
    google_redirect_nonce_invalid: 'Google sign-in nonce validation failed.',
    confirm_revoke_sessions: 'Revoke all refresh sessions for this user?',
    flash_sessions_revoked: 'User sessions revoked.',
    flash_no_active_sessions: 'There were no active sessions to revoke.',
    confirm_delete_message: 'Delete this message?',
    flash_message_deleted: 'Message deleted.',
    asset_still_referenced: 'This asset is still referenced by room messages. Delete those messages first.',
    confirm_clear_avatar: 'This asset is linked as an avatar. Clear the avatar and continue?',
    confirm_delete_asset: 'Delete this asset?',
    flash_asset_deleted: 'Asset deleted.',
    confirm_delete_release: 'Delete this APK release from the feed and server disk?',
    flash_release_deleted: 'Version {version} was deleted.',
    confirm_delete_orphans: 'Delete files on disk that are not tracked in media_assets?',
    flash_orphans_deleted: '{count} files deleted, {bytes} reclaimed.',
    action_failed: 'Action failed.',
    flash_user_updated: 'User profile updated.',
    confirm_delete_matches: 'Delete all matched messages?',
    session_validation_failed: 'Session validation failed. Please sign in again.',
    no_data: 'No data',
    empty_content: 'Empty content'
  }
}

Object.assign(COPY.ko, {
  tab_updates_title: '\uC571 \uC5C5\uB370\uC774\uD2B8',
  tab_updates_copy: '\uCD5C\uC2E0 Android APK \uC5C5\uB85C\uB4DC\uC640 \uBC30\uD3EC \uC0C1\uD0DC\uB97C \uAD00\uB9AC\uD569\uB2C8\uB2E4.',
  updates_title: '\uC571 \uC5C5\uB370\uC774\uD2B8 \uAD00\uB9AC',
  updates_body: '\uAC00\uB514\uC5B8 \uCF58\uC194\uC5D0\uC11C \uCD5C\uC2E0 Android APK\uB97C \uC62C\uB9AC\uACE0 \uBC30\uD3EC \uC0C1\uD0DC\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.',
  latest_release_title: '\uD604\uC7AC \uBC30\uD3EC \uC911\uC778 \uBC84\uC804',
  latest_release_body: '\uD504\uB85C\uD544 \uD0ED\uC5D0\uC11C \uC774 \uBC84\uC804\uC744 \uAE30\uC900\uC73C\uB85C \uC5C5\uB370\uC774\uD2B8 \uBC84\uD2BC\uC774 \uBCF4\uC785\uB2C8\uB2E4.',
  upload_release_title: '\uCD5C\uC2E0 APK \uC62C\uB9AC\uAE30',
  upload_release_body: '\uBE4C\uB4DC\uD55C APK \uD30C\uC77C\uACFC \uBC84\uC804 \uBB38\uC790\uC5F4\uC744 \uD568\uAED8 \uC62C\uB9AC\uBA74 \uC989\uC2DC \uCD5C\uC2E0 \uBC30\uD3EC\uB85C \uBC18\uC601\uB418\uACE0, \uC9C1\uC804 \uBC84\uC804 1\uAC1C\uB9CC \uD568\uAED8 \uC720\uC9C0\uB429\uB2C8\uB2E4.',
  app_version_label: '\uC571 \uBC84\uC804',
  app_version_hint: 'app.json \uC758 expo.version \uAC12\uACFC \uAC19\uC740 \uBC84\uC804\uC744 \uC785\uB825\uD558\uC138\uC694.',
  release_notes_label: '\uBC30\uD3EC \uBA54\uBAA8',
  apk_file_label: 'APK \uD30C\uC77C',
  upload_latest: '\uCD5C\uC2E0 \uBC84\uC804 \uC62C\uB9AC\uAE30',
  uploading_release: '\uC62C\uB9AC\uB294 \uC911...',
  no_release_uploaded: '\uC544\uC9C1 \uC62C\uB77C\uAC04 APK \uBC84\uC804\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
  download_latest: '\uCD5C\uC2E0 APK \uB2E4\uC6B4\uB85C\uB4DC',
  release_history_title: '\uBC30\uD3EC \uC774\uB825',
  release_history_body: '\uAC00\uB514\uC5B8\uC5D0\uB294 \uCD5C\uC2E0 APK\uC640 \uC9C1\uC804 APK\uB9CC \uB0A8\uACE0, \uADF8 \uC774\uC804 \uD30C\uC77C\uC740 \uC0C8 \uBC84\uC804 \uC5C5\uB85C\uB4DC \uC2DC \uC11C\uBC84 \uB514\uC2A4\uD06C\uC5D0\uC11C\uB3C4 \uC0AD\uC81C\uB429\uB2C8\uB2E4.',
  table_version: '\uBC84\uC804',
  table_file: '\uD30C\uC77C',
  table_notes: '\uBA54\uBAA8',
  download_file: '\uB2E4\uC6B4\uB85C\uB4DC',
  app_update_uploaded: '\uBC84\uC804 {version}\uC774 \uCD5C\uC2E0 APK\uB85C \uC5C5\uB85C\uB4DC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
  app_update_file_required: 'APK \uD30C\uC77C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
  latest_badge: '\uCD5C\uC2E0',
  no_notes: '\uBA54\uBAA8 \uC5C6\uC74C'
})

Object.assign(COPY.en, {
  tab_updates_title: 'App Updates',
  tab_updates_copy: 'Upload the latest Android APK and manage the release feed.',
  updates_title: 'App Update Management',
  updates_body: 'Upload the latest Android APK from Guardian Console and review the published release feed.',
  latest_release_title: 'Current Published Version',
  latest_release_body: 'The profile tab uses this version to decide whether an update button should be shown.',
  upload_release_title: 'Upload Latest APK',
  upload_release_body: 'Upload a built APK together with the exact version string to publish it immediately as the latest release while keeping only the previous version alongside it.',
  app_version_label: 'App Version',
  app_version_hint: 'Use the same value as expo.version in app.json.',
  release_notes_label: 'Release Notes',
  apk_file_label: 'APK File',
  upload_latest: 'Upload Latest Version',
  uploading_release: 'Uploading...',
  no_release_uploaded: 'No APK release has been uploaded yet.',
  download_latest: 'Download Latest APK',
  release_history_title: 'Release History',
  release_history_body: 'Guardian keeps only the latest APK and the immediately previous APK. Older files are deleted from disk when a newer build is uploaded.',
  table_version: 'Version',
  table_file: 'File',
  table_notes: 'Notes',
  download_file: 'Download',
  app_update_uploaded: 'Version {version} is now published as the latest APK.',
  app_update_file_required: 'Select an APK file first.',
  latest_badge: 'Latest',
  no_notes: 'No notes'
})

function loadLocale() {
  try {
    const raw = localStorage.getItem('guardian-console-locale')
    return raw === 'en' ? 'en' : 'ko'
  } catch {
    return 'ko'
  }
}

function t(key, vars = {}) {
  const template = COPY[state.locale]?.[key] ?? COPY.en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''))
}

function currentLocaleTag() {
  return state.locale === 'en' ? 'en-US' : 'ko-KR'
}

function setLocale(locale) {
  state.locale = locale === 'en' ? 'en' : 'ko'
  localStorage.setItem('guardian-console-locale', state.locale)
}

function getTabMeta() {
  return {
    dashboard: {
      title: t('tab_dashboard_title'),
      copy: t('tab_dashboard_copy')
    },
    users: {
      title: t('tab_users_title'),
      copy: t('tab_users_copy')
    },
    rooms: {
      title: t('tab_rooms_title'),
      copy: t('tab_rooms_copy')
    },
    storage: {
      title: t('tab_storage_title'),
      copy: t('tab_storage_copy')
    },
    updates: {
      title: t('tab_updates_title'),
      copy: t('tab_updates_copy')
    }
  }
}

const state = {
  session: loadSession(),
  locale: loadLocale(),
  user: null,
  loginForm: {
    loginId: '',
    password: ''
  },
  activeTab: 'dashboard',
  flash: null,
  loading: {
    dashboard: false,
    users: false,
    rooms: false,
    roomMessages: false,
    storage: false,
    updates: false,
    updateUpload: false,
    auth: false
  },
  summary: null,
  familyLinks: [],
  users: [],
  userLocations: {},
  rooms: [],
  selectedRoomId: null,
  roomMessages: {
    items: [],
    nextBefore: null
  },
  storageOverview: null,
  storageAssets: [],
  latestAppUpdate: null,
  appUpdates: [],
  editDraft: null,
  bulkDeletePreview: null,
  filters: {
    users: {
      q: '',
      role: '',
      limit: 100
    },
    rooms: {
      type: '',
      memberUserId: '',
      q: '',
      limit: 60
    },
    storage: {
      ownerUserId: '',
      status: '',
      unreferencedOnly: true,
      limit: 80
    },
    bulkDelete: {
      searchText: 'test',
      roomId: '',
      senderId: '',
      before: '',
      kinds: ['text', 'system'],
      limit: 80
    }
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem('guardian-console-session')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(session) {
  state.session = session
  localStorage.setItem('guardian-console-session', JSON.stringify(session))
}

function clearSession() {
  state.session = null
  state.user = null
  localStorage.removeItem('guardian-console-session')
}

function setFlash(type, message) {
  state.flash = { type, message }
  render()
}

function clearFlash() {
  state.flash = null
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(currentLocaleTag(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

function roleBadge(role) {
  if (role === 'parent') {
    return `<span class="badge teal">${escapeHtml(t('role_parent'))}</span>`
  }

  return `<span class="badge">${escapeHtml(t('role_user'))}</span>`
}

function roleText(role) {
  return role === 'parent' ? t('role_parent') : t('role_user')
}

function statusBadge(label, tone = '') {
  const toneClass = tone ? ` ${tone}` : ''
  return `<span class="badge${toneClass}">${escapeHtml(label)}</span>`
}

function roomTypeLabel(type) {
  return type === 'group' ? t('room_type_group') : t('room_type_direct')
}

function assetStatusLabel(status) {
  if (status === 'completed') return t('asset_status_completed')
  if (status === 'failed') return t('asset_status_failed')
  return t('asset_status_pending')
}

function assetKindLabel(kind) {
  if (kind === 'avatar') return t('asset_kind_avatar')
  return messageKindLabel(kind)
}

function messageKindLabel(kind) {
  if (kind === 'system') return t('message_kind_system')
  if (kind === 'image') return t('message_kind_image')
  if (kind === 'video') return t('message_kind_video')
  return t('message_kind_text')
}

function deliveryLabel(delivery) {
  if (delivery === 'delivered') return t('delivery_delivered')
  if (delivery === 'read') return t('delivery_read')
  return t('delivery_sent')
}

function isSelectedTab(tab) {
  return state.activeTab === tab ? 'is-active' : ''
}

function getSelectedRoom() {
  return state.rooms.find((room) => room.id === state.selectedRoomId) || null
}

function buildQuery(params) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return
    searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const isBodyObject =
    options.body &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    typeof options.body === 'object'

  if (isBodyObject) {
    headers.set('Content-Type', 'application/json')
  }

  if (state.session?.accessToken) {
    headers.set('Authorization', `Bearer ${state.session.accessToken}`)
  }

  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: isBodyObject ? JSON.stringify(options.body) : options.body
  })

  let payload = null
  if (response.status !== 204) {
    payload = await response.json().catch(() => null)
  }

  if (!response.ok || (payload && payload.success === false)) {
    if (response.status === 401 && state.session?.accessToken) {
      clearSession()
      render()
      throw new Error(t('session_validation_failed'))
    }

    const message = payload?.error?.message || `Request failed (${response.status})`
    throw new Error(message)
  }

  return payload?.data ?? payload
}

async function loginWithPassword(loginId, password) {
  state.loading.auth = true
  render()

  try {
    const data = await apiRequest('/v1/guardian/auth/login', {
      method: 'POST',
      body: { loginId, password }
    })

    saveSession({
      accessToken: data.accessToken
    })
    state.user = data.user
    clearFlash()
    await loadAllData()
  } finally {
    state.loading.auth = false
    render()
  }
}

async function fetchMe() {
  return apiRequest('/v1/guardian/auth/me')
}

async function loadDashboard() {
  state.loading.dashboard = true
  render()

  try {
    const [summary, familyLinks] = await Promise.all([
      apiRequest('/v1/guardian/summary'),
      apiRequest('/v1/guardian/family-links')
    ])
    state.summary = summary
    state.familyLinks = familyLinks.items || []
  } finally {
    state.loading.dashboard = false
    render()
  }
}

async function loadUsers() {
  state.loading.users = true
  render()

  try {
    const data = await apiRequest(`/v1/guardian/users${buildQuery(state.filters.users)}`)
    state.users = data.items || []

    if (state.editDraft) {
      const fresh = state.users.find((item) => item.id === state.editDraft.id)
      if (!fresh) {
        state.editDraft = null
      }
    }
  } finally {
    state.loading.users = false
    render()
  }
}

async function loadUserLocation(userId) {
  const data = await apiRequest(`/v1/guardian/users/${userId}/location`)
  state.userLocations[userId] = data
  render()
  return data
}

async function loadRooms() {
  state.loading.rooms = true
  render()

  try {
    const data = await apiRequest(`/v1/guardian/rooms${buildQuery(state.filters.rooms)}`)
    state.rooms = data.items || []

    if (!state.selectedRoomId || !state.rooms.some((room) => room.id === state.selectedRoomId)) {
      state.selectedRoomId = state.rooms[0]?.id || null
    }

    if (state.selectedRoomId) {
      await loadRoomMessages({ reset: true })
    } else {
      state.roomMessages = { items: [], nextBefore: null }
    }
  } finally {
    state.loading.rooms = false
    render()
  }
}

async function loadRoomMessages({ reset = false } = {}) {
  if (!state.selectedRoomId) return

  state.loading.roomMessages = true
  render()

  try {
    const data = await apiRequest(
      `/v1/guardian/rooms/${state.selectedRoomId}/messages${buildQuery({
        limit: 80,
        before: reset ? '' : state.roomMessages.nextBefore
      })}`
    )

    state.roomMessages = {
      items: reset ? data.items || [] : [...state.roomMessages.items, ...(data.items || [])],
      nextBefore: data.nextBefore || null
    }
  } finally {
    state.loading.roomMessages = false
    render()
  }
}

async function loadStorage() {
  state.loading.storage = true
  render()

  try {
    const [overview, assets] = await Promise.all([
      apiRequest('/v1/guardian/storage'),
      apiRequest(`/v1/guardian/storage/assets${buildQuery(state.filters.storage)}`)
    ])
    state.storageOverview = overview
    state.storageAssets = assets.items || []
  } finally {
    state.loading.storage = false
    render()
  }
}

async function loadAppUpdates() {
  state.loading.updates = true
  render()

  try {
    const data = await apiRequest('/v1/guardian/app-updates')
    state.latestAppUpdate = data.latest || null
    state.appUpdates = data.items || []
  } finally {
    state.loading.updates = false
    render()
  }
}

async function loadAllData() {
  state.user = await fetchMe()
  await Promise.all([loadDashboard(), loadUsers(), loadRooms(), loadStorage(), loadAppUpdates()])
}

function renderFlash() {
  if (!state.flash) return ''
  return `<div class="flash ${escapeHtml(state.flash.type)}">${escapeHtml(state.flash.message)}</div>`
}

function renderTopbar() {
  const name = state.user?.displayName || state.user?.email || 'Guardian'
  return `
    <div class="topbar">
      <section class="hero">
        <span class="hero-kicker">ourHangout Guardian Console</span>
        <h1>${escapeHtml(t('hero_title'))}</h1>
        <p>${escapeHtml(t('hero_body'))}</p>
      </section>
      <section class="session-card">
        <div>
          <div class="session-label">${escapeHtml(t('signed_in'))}</div>
          <div class="session-name">${escapeHtml(name)}</div>
          <div class="session-meta">ID: ${escapeHtml(state.user?.email || '')}<br />${escapeHtml(t('role_label'))}: ${escapeHtml(state.user?.role ? roleText(state.user.role) : '-')}</div>
        </div>
        <div class="top-actions">
          <button class="button ${state.locale === 'ko' ? 'secondary' : 'ghost'}" data-set-locale="ko">KO</button>
          <button class="button ${state.locale === 'en' ? 'secondary' : 'ghost'}" data-set-locale="en">EN</button>
          <button class="button secondary" data-action="refresh-current">${escapeHtml(t('refresh_current_tab'))}</button>
          <button class="button ghost" data-action="logout">${escapeHtml(t('log_out'))}</button>
        </div>
      </section>
    </div>
  `
}

function renderSidebar() {
  const tabMeta = getTabMeta()
  return `
    <aside class="sidebar">
      <div class="nav-title">${escapeHtml(t('console_areas'))}</div>
      <div class="nav-list">
        ${Object.entries(tabMeta)
          .map(
            ([key, meta]) => `
              <button class="nav-button ${isSelectedTab(key)}" data-tab="${key}">
                <strong>${escapeHtml(meta.title)}</strong>
                <span>${escapeHtml(meta.copy)}</span>
              </button>
            `
          )
          .join('')}
      </div>
    </aside>
  `
}

function renderKpi(label, value, sub) {
  return `
    <article class="kpi">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
      <div class="kpi-sub">${escapeHtml(sub)}</div>
    </article>
  `
}

function renderLogin() {
  return `
    <div class="login-wrap">
      <section class="login-card">
        <span class="hero-kicker">${escapeHtml(t('login_kicker'))}</span>
        <div class="top-actions" style="margin:14px 0 6px">
          <button class="button ${state.locale === 'ko' ? 'secondary' : 'ghost'}" type="button" data-set-locale="ko">KO</button>
          <button class="button ${state.locale === 'en' ? 'secondary' : 'ghost'}" type="button" data-set-locale="en">EN</button>
        </div>
        <h1>${escapeHtml(t('login_title'))}</h1>
        <p>${escapeHtml(t('login_fixed_body'))}</p>
        ${renderFlash()}
        <form id="guardian-login-form" class="section-stack">
          <div class="field">
            <label for="guardian-login-id">${escapeHtml(t('login_id_label'))}</label>
            <input
              id="guardian-login-id"
              class="input"
              name="loginId"
              type="text"
              autocomplete="username"
              value="${escapeHtml(state.loginForm.loginId)}"
              required
            />
          </div>
          <div class="field">
            <label for="guardian-login-password">${escapeHtml(t('login_password_label'))}</label>
            <input
              id="guardian-login-password"
              class="input"
              name="password"
              type="password"
              autocomplete="current-password"
              value="${escapeHtml(state.loginForm.password)}"
              required
            />
            <div class="muted">${escapeHtml(t('login_password_hint'))}</div>
          </div>
          <button class="button primary" type="submit" ${state.loading.auth ? 'disabled' : ''}>
            ${escapeHtml(state.loading.auth ? t('signing_in') : t('login_button'))}
          </button>
        </form>
        <div class="footer-note">${escapeHtml(t('footer_note_credentials'))}</div>
      </section>
    </div>
  `
}

function renderDashboard() {
  const summary = state.summary

  if (state.loading.dashboard && !summary) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">${escapeHtml(t('dashboard_loading_title'))}</h2>
            <p class="panel-copy">${escapeHtml(t('dashboard_loading_body'))}</p>
          </div>
        </div>
        <div class="empty-state">${escapeHtml(t('dashboard_loading_state'))}</div>
      </section>
    `
  }

  if (!summary) {
    return `
      <section class="panel">
        <div class="empty-state">${escapeHtml(t('dashboard_no_data'))}</div>
      </section>
    `
  }

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${escapeHtml(t('snapshot_title'))}</h2>
          <p class="panel-copy">${escapeHtml(t('snapshot_body'))}</p>
        </div>
        <div class="pill-row">
          ${statusBadge(t('badge_parent_child', { count: summary.moderation.parentChildLinks }), 'teal')}
          ${statusBadge(t('badge_open_reports', { count: summary.moderation.openReports }), summary.moderation.openReports > 0 ? 'danger' : 'teal')}
          ${statusBadge(t('badge_test_like', { count: summary.messages.recentTestLike }), summary.messages.recentTestLike > 0 ? 'danger' : '')}
        </div>
      </div>
      <div class="kpi-grid">
        ${renderKpi(t('kpi_users'), summary.users.total, t('kpi_users_sub', { parents: summary.users.parents, children: summary.users.children }))}
        ${renderKpi(t('kpi_rooms'), summary.rooms.total, t('kpi_rooms_sub', { direct: summary.rooms.direct, group: summary.rooms.group }))}
        ${renderKpi(t('kpi_messages'), summary.messages.total, t('kpi_messages_sub', { text: summary.messages.text, media: summary.messages.image + summary.messages.video }))}
        ${renderKpi(t('kpi_storage'), formatBytes(summary.storage.trackedBytes), t('kpi_storage_sub', { bytes: formatBytes(summary.storage.actualDiskBytes) }))}
      </div>
    </section>

    <section class="split-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">${escapeHtml(t('family_links_title'))}</h2>
            <p class="panel-copy">${escapeHtml(t('family_links_body'))}</p>
          </div>
        </div>
        <div class="card-list">
          ${
            state.familyLinks.length
              ? state.familyLinks
                  .map(
                    (link) => `
                      <article class="info-card">
                        <div class="message-head">
                          <strong>${escapeHtml(link.parent.name)} -> ${escapeHtml(link.child.name)}</strong>
                          <span class="chip">${formatDate(link.createdAt)}</span>
                        </div>
                        <div class="muted">${escapeHtml(link.parent.email)} / ${escapeHtml(link.child.email)}</div>
                      </article>
                    `
                  )
                  .join('')
              : `<div class="empty-state">${escapeHtml(t('no_family_links'))}</div>`
          }
        </div>
      </section>

      <div class="mini-grid">
        <section class="mini-panel">
          <h3>${escapeHtml(t('storage_alerts_title'))}</h3>
          <p>${escapeHtml(t('storage_alerts_body'))}</p>
          <div class="stat-grid">
            ${statusBadge(t('kpi_orphans', { count: summary.storage.orphanFileCount }), summary.storage.orphanFileCount > 0 ? 'danger' : 'teal')}
            ${statusBadge(t('kpi_orphans_sub', { count: summary.storage.missingTrackedFileCount }), summary.storage.missingTrackedFileCount > 0 ? 'danger' : 'teal')}
          </div>
          <div class="card-list" style="margin-top:12px">
            ${
              summary.orphanFiles.length
                ? summary.orphanFiles
                    .map(
                      (file) => `
                        <article class="info-card">
                          <strong>${escapeHtml(file.relativePath)}</strong>
                          <div class="muted">${formatBytes(file.sizeBytes)}</div>
                        </article>
                      `
                    )
                    .join('')
                : `<div class="empty-state">${escapeHtml(t('no_orphan_files'))}</div>`
            }
          </div>
        </section>

        <section class="mini-panel">
          <h3>${escapeHtml(t('top_storage_users_title'))}</h3>
          <p>${escapeHtml(t('top_storage_users_body'))}</p>
          <div class="card-list">
            ${
              summary.topStorageUsers.length
                ? summary.topStorageUsers
                    .map(
                      (user) => `
                        <article class="info-card">
                          <div class="message-head">
                            <strong>${escapeHtml(user.name)}</strong>
                            ${roleBadge(state.users.find((item) => item.id === user.userId)?.role || 'user')}
                          </div>
                          <div class="muted">${escapeHtml(user.email)}</div>
                          <div class="message-foot" style="margin-top:10px">
                            <span class="chip">${formatBytes(user.storageBytes)}</span>
                            <span class="chip">${escapeHtml(t('assets_count', { count: user.assetCount }))}</span>
                          </div>
                        </article>
                      `
                    )
                    .join('')
                : `<div class="empty-state">${escapeHtml(t('no_upload_assets'))}</div>`
            }
          </div>
        </section>
      </div>
    </section>
  `
}

function renderUserOptions(selectedValue, includeBlankLabel = t('all_users')) {
  return `
    <option value="">${escapeHtml(includeBlankLabel)}</option>
    ${state.users
      .map(
        (user) => `
          <option value="${escapeHtml(user.id)}" ${user.id === selectedValue ? 'selected' : ''}>
            ${escapeHtml(user.effectiveName)} | ${escapeHtml(user.email)}
          </option>
        `
      )
      .join('')}
  `
}

function renderUsers() {
  const draft = state.editDraft

  return `
    <section class="panel section-stack">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${escapeHtml(t('users_title'))}</h2>
          <p class="panel-copy">${escapeHtml(t('users_body'))}</p>
        </div>
      </div>

      <form id="user-filter-form" class="form-grid">
        <div class="wide-field">
          <label for="user-q">${escapeHtml(t('search_label'))}</label>
          <input class="input" id="user-q" name="q" value="${escapeHtml(state.filters.users.q)}" placeholder="${escapeHtml(t('search_users_placeholder'))}" />
        </div>
        <div class="field">
          <label for="user-role">${escapeHtml(t('role_filter_label'))}</label>
          <select class="select" id="user-role" name="role">
            <option value="">${escapeHtml(t('all_option'))}</option>
            <option value="parent" ${state.filters.users.role === 'parent' ? 'selected' : ''}>${escapeHtml(t('role_parent'))}</option>
            <option value="user" ${state.filters.users.role === 'user' ? 'selected' : ''}>${escapeHtml(t('role_user'))}</option>
          </select>
        </div>
        <div class="field">
          <label for="user-limit">${escapeHtml(t('limit_label'))}</label>
          <input class="input" id="user-limit" name="limit" type="number" min="1" max="200" value="${escapeHtml(state.filters.users.limit)}" />
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">${escapeHtml(t('load_users'))}</button>
          <button class="button ghost" type="button" data-action="refresh-users">${escapeHtml(t('refresh'))}</button>
        </div>
      </form>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>${escapeHtml(t('table_user'))}</th>
              <th>${escapeHtml(t('table_role'))}</th>
              <th>${escapeHtml(t('table_activity'))}</th>
              <th>${escapeHtml(t('table_storage'))}</th>
              <th>${escapeHtml(t('table_meta'))}</th>
              <th>${escapeHtml(t('table_actions'))}</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.users.length
                ? state.users
                    .map(
                      (user) => `
                        <tr>
                          <td>
                            <strong>${escapeHtml(user.effectiveName)}</strong>
                            <div class="muted">${escapeHtml(user.email)}</div>
                            <div class="muted">${user.phoneE164 ? escapeHtml(user.phoneE164) : escapeHtml(t('no_phone'))}</div>
                          </td>
                          <td>${roleBadge(user.role)}</td>
                          <td>
                            <div class="stack">
                              <span>${escapeHtml(t('rooms_count', { count: user.roomCount }))}</span>
                              <span>${escapeHtml(t('messages_count', { count: user.messageCount }))}</span>
                              <span>${escapeHtml(t('family_links_count', { count: user.familyLinkCount }))}</span>
                            </div>
                          </td>
                          <td>${formatBytes(user.storageBytes)}</td>
                          <td>
                            <div class="stack muted">
                              <span>${user.locale || '-'}</span>
                              <span>${user.statusMessage ? escapeHtml(user.statusMessage) : escapeHtml(t('no_status'))}</span>
                              <span>${escapeHtml(user.locationSharingEnabled ? t('location_sharing_on') : t('location_sharing_off'))}</span>
                              <span>${user.latestLocationAt ? escapeHtml(t('latest_location_at', { time: formatDate(user.latestLocationAt) })) : escapeHtml(t('no_location_yet'))}</span>
                              <span>${formatDate(user.updatedAt)}</span>
                            </div>
                          </td>
                          <td>
                            <div class="button-row">
                              <button class="button secondary" type="button" data-edit-user="${escapeHtml(user.id)}">${escapeHtml(t('edit'))}</button>
                              ${
                                user.locationSharingEnabled
                                  ? `<button class="button ghost" type="button" data-view-location="${escapeHtml(user.id)}">${escapeHtml(t('view_location'))}</button>
                                     <button class="button ghost" type="button" data-refresh-location="${escapeHtml(user.id)}">${escapeHtml(t('precise_refresh'))}</button>`
                                  : ''
                              }
                              <button class="button danger" type="button" data-revoke-user="${escapeHtml(user.id)}">${escapeHtml(t('revoke_sessions'))}</button>
                            </div>
                          </td>
                        </tr>
                      `
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="6">
                      <div class="empty-state">${escapeHtml(t('no_users_matched'))}</div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>

      ${
        draft
          ? `
            <section class="mini-panel">
              <div class="panel-header">
                <div>
                  <h3 style="margin:0">${escapeHtml(t('edit_user_title', { name: draft.effectiveName }))}</h3>
                  <p class="panel-copy">${escapeHtml(t('edit_user_body'))}</p>
                </div>
                <button class="button ghost" type="button" data-action="cancel-edit">${escapeHtml(t('close'))}</button>
              </div>
              <form id="user-edit-form" class="form-grid">
                <input type="hidden" name="userId" value="${escapeHtml(draft.id)}" />
                <div class="field">
                  <label for="edit-role">${escapeHtml(t('role_filter_label'))}</label>
                  <select class="select" id="edit-role" name="role">
                    <option value="parent" ${draft.role === 'parent' ? 'selected' : ''}>${escapeHtml(t('role_parent'))}</option>
                    <option value="user" ${draft.role === 'user' ? 'selected' : ''}>${escapeHtml(t('role_user'))}</option>
                  </select>
                </div>
                <div class="wide-field">
                  <label for="edit-name">${escapeHtml(t('display_name_label'))}</label>
                  <input class="input" id="edit-name" name="displayName" value="${escapeHtml(draft.displayName || '')}" />
                </div>
                <div class="field">
                  <label for="edit-phone">${escapeHtml(t('phone_label'))}</label>
                  <input class="input" id="edit-phone" name="phoneE164" value="${escapeHtml(draft.phoneE164 || '')}" placeholder="+821012345678" />
                </div>
                <div class="field">
                  <label for="edit-locale">${escapeHtml(t('locale_label'))}</label>
                  <input class="input" id="edit-locale" name="locale" value="${escapeHtml(draft.locale || '')}" placeholder="ko-KR" />
                </div>
                <div class="wide-field">
                  <label for="edit-status">${escapeHtml(t('status_message_label'))}</label>
                  <textarea class="textarea" id="edit-status" name="statusMessage">${escapeHtml(draft.statusMessage || '')}</textarea>
                </div>
                <div class="button-row">
                  <button class="button primary" type="submit">${escapeHtml(t('save'))}</button>
                  <button class="button ghost" type="button" data-action="cancel-edit">${escapeHtml(t('cancel'))}</button>
                </div>
              </form>
              ${
                state.userLocations[draft.id]
                  ? `<div class="panel" style="padding:16px; margin-top:12px">
                      <h4 style="margin:0 0 8px">Location</h4>
                      <div class="stack muted">
                        <span>Sharing: ${state.userLocations[draft.id].sharingEnabled ? 'ON' : 'OFF'}</span>
                        ${
                          state.userLocations[draft.id].location
                            ? `<span>${escapeHtml(String(state.userLocations[draft.id].location.latitude))}, ${escapeHtml(String(state.userLocations[draft.id].location.longitude))}</span>
                               <span>${escapeHtml(formatDate(state.userLocations[draft.id].location.capturedAt))}</span>
                               <span>${escapeHtml(state.userLocations[draft.id].location.source)}</span>
                               <div class="button-row">
                                 <button class="button ghost" type="button" data-open-location="${escapeHtml(draft.id)}">${escapeHtml(t('open_map'))}</button>
                               </div>`
                            : `<span>${escapeHtml(t('no_location_yet'))}</span>`
                        }
                      </div>
                    </div>`
                  : ''
              }
            </section>
          `
          : ''
      }
    </section>
  `
}

function renderRooms() {
  const selectedRoom = getSelectedRoom()
  const bulkKinds = new Set(state.filters.bulkDelete.kinds)

  return `
    <section class="panel section-stack">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${escapeHtml(t('message_review_title'))}</h2>
          <p class="panel-copy">${escapeHtml(t('message_review_body'))}</p>
        </div>
      </div>

      <form id="room-filter-form" class="form-grid">
        <div class="field">
          <label for="room-type">${escapeHtml(t('room_type_label'))}</label>
          <select class="select" id="room-type" name="type">
            <option value="">${escapeHtml(t('all_option'))}</option>
            <option value="direct" ${state.filters.rooms.type === 'direct' ? 'selected' : ''}>${escapeHtml(t('room_type_direct'))}</option>
            <option value="group" ${state.filters.rooms.type === 'group' ? 'selected' : ''}>${escapeHtml(t('room_type_group'))}</option>
          </select>
        </div>
        <div class="wide-field">
          <label for="room-member">${escapeHtml(t('child_filter_label'))}</label>
          <select class="select" id="room-member" name="memberUserId">
            <option value="">${escapeHtml(t('all_linked_children'))}</option>
            ${state.familyLinks
              .map(
                (link) => `
                  <option value="${escapeHtml(link.child.userId)}" ${state.filters.rooms.memberUserId === link.child.userId ? 'selected' : ''}>
                    ${escapeHtml(link.child.name)} | ${escapeHtml(link.child.email)}
                  </option>
                `
              )
              .join('')}
          </select>
        </div>
        <div class="wide-field">
          <label for="room-q">${escapeHtml(t('search_label'))}</label>
          <input class="input" id="room-q" name="q" value="${escapeHtml(state.filters.rooms.q)}" placeholder="${escapeHtml(t('room_search_placeholder'))}" />
        </div>
        <div class="field">
          <label for="room-limit">${escapeHtml(t('limit_label'))}</label>
          <input class="input" id="room-limit" name="limit" type="number" min="1" max="120" value="${escapeHtml(state.filters.rooms.limit)}" />
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">${escapeHtml(t('load_rooms'))}</button>
          <button class="button ghost" type="button" data-action="refresh-rooms">${escapeHtml(t('refresh'))}</button>
        </div>
      </form>

      <section class="mini-panel">
        <div class="panel-header">
          <div>
            <h3 style="margin:0">${escapeHtml(t('bulk_cleanup_title'))}</h3>
            <p class="panel-copy">${escapeHtml(t('bulk_cleanup_body'))}</p>
          </div>
        </div>
        <form id="bulk-delete-form" class="form-grid">
          <div class="wide-field">
            <label for="bulk-searchText">${escapeHtml(t('search_text_label'))}</label>
            <input class="input" id="bulk-searchText" name="searchText" value="${escapeHtml(state.filters.bulkDelete.searchText)}" placeholder="test" />
          </div>
          <div class="field">
            <label for="bulk-roomId">${escapeHtml(t('room_label'))}</label>
            <select class="select" id="bulk-roomId" name="roomId">
              <option value="">${escapeHtml(t('all_rooms'))}</option>
              ${state.rooms
                .map(
                  (room) => `
                    <option value="${escapeHtml(room.id)}" ${state.filters.bulkDelete.roomId === room.id ? 'selected' : ''}>
                      ${escapeHtml(room.title)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>
          <div class="field">
            <label for="bulk-senderId">${escapeHtml(t('sender_label'))}</label>
            <select class="select" id="bulk-senderId" name="senderId">
              ${renderUserOptions(state.filters.bulkDelete.senderId)}
            </select>
          </div>
          <div class="field">
            <label for="bulk-before">${escapeHtml(t('before_label'))}</label>
            <input class="input" id="bulk-before" name="before" type="datetime-local" value="${escapeHtml(state.filters.bulkDelete.before)}" />
          </div>
          <div class="field">
            <label for="bulk-limit">${escapeHtml(t('limit_label'))}</label>
            <input class="input" id="bulk-limit" name="limit" type="number" min="1" max="500" value="${escapeHtml(state.filters.bulkDelete.limit)}" />
          </div>
          <div class="wide-field">
            <label>${escapeHtml(t('message_kinds_label'))}</label>
            <div class="filter-row">
              ${['text', 'system', 'image', 'video']
                .map(
                  (kind) => `
                    <label class="chip">
                      <input type="checkbox" name="kinds" value="${kind}" ${bulkKinds.has(kind) ? 'checked' : ''} />
                      ${escapeHtml(messageKindLabel(kind))}
                    </label>
                  `
                )
                .join('')}
            </div>
          </div>
          <div class="button-row">
            <button class="button secondary" type="submit" name="mode" value="preview">${escapeHtml(t('preview'))}</button>
            <button class="button danger" type="submit" name="mode" value="delete">${escapeHtml(t('delete_matches'))}</button>
          </div>
        </form>
        ${
          state.bulkDeletePreview
            ? `
              <div class="card-list" style="margin-top:16px">
                <article class="info-card">
                  <div class="message-head">
                    <strong>${escapeHtml(t('preview_result'))}</strong>
                    ${statusBadge(t('matches_count', { count: state.bulkDeletePreview.matchedCount }), state.bulkDeletePreview.deletedCount > 0 ? 'danger' : 'teal')}
                  </div>
                  <div class="muted">${escapeHtml(state.bulkDeletePreview.dryRun ? t('preview_only') : t('messages_deleted_count', { count: state.bulkDeletePreview.deletedCount }))}</div>
                </article>
                ${
                  state.bulkDeletePreview.items.length
                    ? state.bulkDeletePreview.items
                        .slice(0, 8)
                        .map(
                          (message) => `
                            <article class="info-card">
                              <div class="message-head">
                                <strong>${escapeHtml(message.senderName)} | ${escapeHtml(messageKindLabel(message.kind))}</strong>
                                <span class="chip">${formatDate(message.createdAt)}</span>
                              </div>
                              <div class="muted">${escapeHtml(message.roomTitle || message.roomId)}</div>
                              <div class="message-body">${escapeHtml(message.text || message.uri || t('empty_content'))}</div>
                            </article>
                          `
                        )
                        .join('')
                    : `<div class="empty-state">${escapeHtml(t('no_bulk_matches'))}</div>`
                }
              </div>
            `
            : ''
        }
      </section>

      <div class="room-grid">
        <section class="mini-panel">
          <div class="panel-header">
            <div>
              <h3 style="margin:0">${escapeHtml(t('rooms_title'))}</h3>
              <p class="panel-copy">${escapeHtml(t('rooms_body'))}</p>
            </div>
          </div>
          <div class="room-list">
            ${
              state.rooms.length
                ? state.rooms
                    .map(
                      (room) => `
                        <button class="room-card ${room.id === state.selectedRoomId ? 'is-selected' : ''}" type="button" data-select-room="${escapeHtml(room.id)}">
                          <div class="room-title">${escapeHtml(room.title)}</div>
                          <div class="room-meta">
                            ${statusBadge(roomTypeLabel(room.type), room.type === 'group' ? 'teal' : '')}
                            <span class="chip">${escapeHtml(t('messages_count', { count: room.messageCount }))}</span>
                            <span class="chip">${escapeHtml(t('members_count', { count: room.activeMemberCount }))}</span>
                          </div>
                          <div class="muted" style="margin-top:10px">${escapeHtml(room.members.map((member) => member.name).join(', '))}</div>
                          <div class="muted" style="margin-top:8px">${room.lastMessage ? escapeHtml(`${room.lastMessage.senderName}: ${room.lastMessage.preview || messageKindLabel(room.lastMessage.kind)}`) : escapeHtml(t('no_messages_yet'))}</div>
                        </button>
                      `
                    )
                    .join('')
                : `<div class="empty-state">${escapeHtml(t('no_rooms_matched'))}</div>`
            }
          </div>
        </section>

        <section class="mini-panel">
          <div class="panel-header">
            <div>
              <h3 style="margin:0">${selectedRoom ? escapeHtml(selectedRoom.title) : escapeHtml(t('select_room'))}</h3>
              <p class="panel-copy">${selectedRoom ? `${selectedRoom.members.map((member) => member.name).join(', ')}` : escapeHtml(t('select_room_body'))}</p>
            </div>
            ${selectedRoom ? `<button class="button ghost" type="button" data-action="refresh-room-messages">${escapeHtml(t('refresh_messages'))}</button>` : ''}
          </div>
          <div class="message-list">
            ${
              selectedRoom
                ? state.roomMessages.items.length
                  ? state.roomMessages.items
                      .map(
                        (message) => `
                          <article class="message-card">
                            <div class="message-head">
                              <strong>${escapeHtml(message.senderName)}</strong>
                              <div class="filter-row">
                                ${statusBadge(messageKindLabel(message.kind), message.kind === 'system' ? 'teal' : '')}
                                <span class="chip">${formatDate(message.createdAt)}</span>
                              </div>
                            </div>
                            <div class="message-body">${escapeHtml(message.text || t('no_text_payload'))}</div>
                            ${message.uri ? `<div class="message-media">${escapeHtml(message.uri)}</div>` : ''}
                            <div class="message-foot" style="margin-top:12px">
                              <span class="muted">${escapeHtml(deliveryLabel(message.delivery))}</span>
                              <button class="button danger" type="button" data-delete-message="${escapeHtml(message.id)}">${escapeHtml(t('delete'))}</button>
                            </div>
                          </article>
                        `
                      )
                      .join('')
                  : `<div class="room-empty">${escapeHtml(t('no_messages_loaded'))}</div>`
                : `<div class="room-empty">${escapeHtml(t('select_room'))}</div>`
            }
            ${selectedRoom && state.roomMessages.nextBefore ? `<button class="button ghost" type="button" data-action="load-older">${escapeHtml(t('load_older_messages'))}</button>` : ''}
          </div>
        </section>
      </div>
    </section>
  `
}

function renderStorage() {
  const overview = state.storageOverview

  return `
    <section class="panel section-stack">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${escapeHtml(t('storage_title'))}</h2>
          <p class="panel-copy">${escapeHtml(t('storage_body'))}</p>
        </div>
        <div class="button-row">
          <button class="button secondary" type="button" data-action="refresh-storage">${escapeHtml(t('refresh'))}</button>
          <button class="button danger" type="button" data-action="cleanup-orphans">${escapeHtml(t('delete_orphan_files'))}</button>
        </div>
      </div>

      ${
        overview
          ? `
            <div class="kpi-grid">
              ${renderKpi(t('kpi_tracked'), overview.totals.trackedAssets, t('kpi_tracked_sub', { completed: overview.totals.completedAssets, pending: overview.totals.pendingAssets }))}
              ${renderKpi(t('kpi_tracked_bytes'), formatBytes(overview.totals.trackedBytes), t('kpi_storage_sub', { bytes: formatBytes(overview.totals.actualDiskBytes) }))}
              ${renderKpi(t('kpi_orphans'), overview.totals.orphanFileCount, t('kpi_orphans_sub', { count: overview.totals.missingTrackedFileCount }))}
              ${renderKpi(t('kpi_failed_assets'), overview.totals.failedAssets, t('kpi_failed_assets_sub'))}
            </div>

            <div class="split-grid">
              <section class="mini-panel">
                <h3>${escapeHtml(t('by_kind_title'))}</h3>
                <div class="card-list">
                  ${overview.byKind
                    .map(
                      (item) => `
                        <article class="info-card">
                          <div class="message-head">
                            <strong>${escapeHtml(assetKindLabel(item.kind))}</strong>
                            <span class="chip">${escapeHtml(t('assets_count', { count: item.assetCount }))}</span>
                          </div>
                          <div class="muted">${formatBytes(item.totalBytes)}</div>
                        </article>
                      `
                    )
                    .join('')}
                </div>
              </section>
              <section class="mini-panel">
                <h3>${escapeHtml(t('top_users_title'))}</h3>
                <div class="card-list">
                  ${overview.topUsers
                    .map(
                      (user) => `
                        <article class="info-card">
                          <div class="message-head">
                            <strong>${escapeHtml(user.name)}</strong>
                            <span class="chip">${formatBytes(user.storageBytes)}</span>
                          </div>
                          <div class="muted">${escapeHtml(user.email)}</div>
                          <div class="muted">${escapeHtml(t('assets_count', { count: user.assetCount }))}</div>
                        </article>
                      `
                    )
                    .join('')}
                </div>
              </section>
            </div>
          `
          : `<div class="empty-state">${escapeHtml(t('loading_storage_overview'))}</div>`
      }

      <form id="storage-filter-form" class="form-grid">
        <div class="wide-field">
          <label for="storage-ownerUserId">${escapeHtml(t('owner_label'))}</label>
          <select class="select" id="storage-ownerUserId" name="ownerUserId">
            ${renderUserOptions(state.filters.storage.ownerUserId, t('all_owners'))}
          </select>
        </div>
        <div class="field">
          <label for="storage-status">${escapeHtml(t('status_label'))}</label>
          <select class="select" id="storage-status" name="status">
            <option value="">${escapeHtml(t('all_option'))}</option>
            <option value="completed" ${state.filters.storage.status === 'completed' ? 'selected' : ''}>${escapeHtml(t('asset_status_completed'))}</option>
            <option value="pending" ${state.filters.storage.status === 'pending' ? 'selected' : ''}>${escapeHtml(t('asset_status_pending'))}</option>
            <option value="failed" ${state.filters.storage.status === 'failed' ? 'selected' : ''}>${escapeHtml(t('asset_status_failed'))}</option>
          </select>
        </div>
        <div class="field">
          <label for="storage-limit">${escapeHtml(t('limit_label'))}</label>
          <input class="input" id="storage-limit" name="limit" type="number" min="1" max="200" value="${escapeHtml(state.filters.storage.limit)}" />
        </div>
        <div class="field">
          <label class="chip" style="margin-top:28px">
            <input type="checkbox" name="unreferencedOnly" ${state.filters.storage.unreferencedOnly ? 'checked' : ''} />
            ${escapeHtml(t('unreferenced_only'))}
          </label>
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">${escapeHtml(t('load_assets'))}</button>
        </div>
      </form>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>${escapeHtml(t('table_owner'))}</th>
              <th>${escapeHtml(t('table_asset'))}</th>
              <th>${escapeHtml(t('table_references'))}</th>
              <th>${escapeHtml(t('table_file_state'))}</th>
              <th>${escapeHtml(t('table_updated'))}</th>
              <th>${escapeHtml(t('table_actions'))}</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.storageAssets.length
                ? state.storageAssets
                    .map(
                      (asset) => `
                        <tr>
                          <td>
                            <strong>${escapeHtml(asset.owner.name)}</strong>
                            <div class="muted">${escapeHtml(asset.owner.email)}</div>
                          </td>
                          <td>
                            <div class="stack">
                              <span>${statusBadge(assetKindLabel(asset.kind), asset.kind === 'video' ? 'teal' : '')}</span>
                              <span>${escapeHtml(asset.mimeType)}</span>
                              <span>${formatBytes(asset.sizeBytes)}</span>
                              <span class="muted">${escapeHtml(asset.fileUrl)}</span>
                            </div>
                          </td>
                          <td>
                            <div class="stack">
                              <span>${escapeHtml(asset.referencedByAvatar ? t('avatar_linked') : t('avatar_not_linked'))}</span>
                              <span>${escapeHtml(t('room_message_refs', { count: asset.messageReferenceCount }))}</span>
                              <span>${statusBadge(assetStatusLabel(asset.status), asset.status === 'failed' ? 'danger' : asset.status === 'completed' ? 'teal' : '')}</span>
                            </div>
                          </td>
                          <td>
                            <div class="stack">
                              <span>${escapeHtml(asset.fileExists ? t('file_exists') : t('file_missing'))}</span>
                              <span>${asset.actualSizeBytes !== undefined ? formatBytes(asset.actualSizeBytes) : '-'}</span>
                            </div>
                          </td>
                          <td>${formatDate(asset.updatedAt)}</td>
                          <td>
                            <button
                              class="button danger"
                              type="button"
                              data-delete-asset="${escapeHtml(asset.id)}"
                              data-avatar-ref="${asset.referencedByAvatar ? '1' : '0'}"
                              data-message-refs="${asset.messageReferenceCount}"
                            >
                              ${escapeHtml(t('delete'))}
                            </button>
                          </td>
                        </tr>
                      `
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="6">
                      <div class="empty-state">${escapeHtml(t('no_assets_matched'))}</div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderUpdates() {
  const latest = state.latestAppUpdate

  return `
    <section class="panel section-stack">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${escapeHtml(t('updates_title'))}</h2>
          <p class="panel-copy">${escapeHtml(t('updates_body'))}</p>
        </div>
        <div class="button-row">
          <button class="button ghost" type="button" data-action="refresh-updates">${escapeHtml(t('refresh'))}</button>
        </div>
      </div>

      <div class="split-grid">
        <section class="mini-panel">
          <h3>${escapeHtml(t('latest_release_title'))}</h3>
          <p>${escapeHtml(t('latest_release_body'))}</p>
          ${
            latest
              ? `
                <article class="info-card">
                  <div class="message-head">
                    <strong>${escapeHtml(latest.version)}</strong>
                    <div class="filter-row">
                      ${latest.isLatest ? statusBadge(t('latest_badge'), 'teal') : ''}
                      ${statusBadge(latest.fileExists ? t('file_exists') : t('file_missing'), latest.fileExists ? 'teal' : 'danger')}
                    </div>
                  </div>
                  <div class="stack release-notes">
                    <span>${escapeHtml(t('table_file'))}: ${escapeHtml(latest.fileName)}</span>
                    <span>${escapeHtml(t('table_updated'))}: ${formatDate(latest.uploadedAt)}</span>
                    <span>${escapeHtml(t('table_storage'))}: ${formatBytes(latest.sizeBytes)}</span>
                    <span>${escapeHtml(latest.notes || t('no_notes'))}</span>
                  </div>
                  <div class="button-row" style="margin-top:12px">
                    ${
                      latest.fileExists
                        ? `<a class="button secondary" href="${escapeHtml(latest.latestDownloadUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t('download_latest'))}</a>`
                        : ''
                    }
                  </div>
                </article>
              `
              : `<div class="empty-state">${escapeHtml(t('no_release_uploaded'))}</div>`
          }
        </section>

        <section class="mini-panel">
          <h3>${escapeHtml(t('upload_release_title'))}</h3>
          <p>${escapeHtml(t('upload_release_body'))}</p>
          <form id="app-updates-upload-form" class="section-stack">
            <div class="field">
              <label for="app-update-version">${escapeHtml(t('app_version_label'))}</label>
              <input id="app-update-version" class="input" name="version" type="text" placeholder="1.0.1" required />
              <div class="muted">${escapeHtml(t('app_version_hint'))}</div>
            </div>
            <div class="field">
              <label for="app-update-notes">${escapeHtml(t('release_notes_label'))}</label>
              <textarea id="app-update-notes" class="textarea" name="notes" placeholder="What changed in this build?"></textarea>
            </div>
            <div class="field">
              <label for="app-update-file">${escapeHtml(t('apk_file_label'))}</label>
              <input
                id="app-update-file"
                class="input"
                name="apkFile"
                type="file"
                accept=".apk,application/vnd.android.package-archive,application/octet-stream"
                required
              />
            </div>
            <div class="button-row">
              <button class="button primary" type="submit" ${state.loading.updateUpload ? 'disabled' : ''}>
                ${escapeHtml(state.loading.updateUpload ? t('uploading_release') : t('upload_latest'))}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section class="mini-panel">
        <h3>${escapeHtml(t('release_history_title'))}</h3>
        <p>${escapeHtml(t('release_history_body'))}</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>${escapeHtml(t('table_version'))}</th>
                <th>${escapeHtml(t('table_file'))}</th>
                <th>${escapeHtml(t('table_notes'))}</th>
                <th>${escapeHtml(t('table_updated'))}</th>
                <th>${escapeHtml(t('table_actions'))}</th>
              </tr>
            </thead>
            <tbody>
              ${
                state.appUpdates.length
                  ? state.appUpdates
                      .map(
                        (release) => `
                          <tr>
                            <td>
                              <strong>${escapeHtml(release.version)}</strong>
                              ${release.isLatest ? statusBadge(t('latest_badge'), 'teal') : ''}
                            </td>
                            <td>
                              <div class="stack">
                                <span>${escapeHtml(release.fileName)}</span>
                                <span>${statusBadge(release.fileExists ? t('file_exists') : t('file_missing'), release.fileExists ? 'teal' : 'danger')}</span>
                                <span>${formatBytes(release.sizeBytes)}</span>
                              </div>
                            </td>
                            <td><div class="release-notes">${escapeHtml(release.notes || t('no_notes'))}</div></td>
                            <td>${formatDate(release.uploadedAt)}</td>
                            <td>
                              ${
                                release.fileExists
                                  ? `<a class="button ghost" href="${escapeHtml(release.downloadUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t('download_file'))}</a>`
                                  : ''
                              }
                              <button class="button danger" type="button" data-delete-release="${escapeHtml(release.version)}">${escapeHtml(t('delete'))}</button>
                            </td>
                          </tr>
                        `
                      )
                      .join('')
                  : `
                    <tr>
                      <td colspan="5">
                        <div class="empty-state">${escapeHtml(t('no_release_uploaded'))}</div>
                      </td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
}

function renderActiveTab() {
  switch (state.activeTab) {
    case 'users':
      return renderUsers()
    case 'rooms':
      return renderRooms()
    case 'storage':
      return renderStorage()
    case 'updates':
      return renderUpdates()
    case 'dashboard':
    default:
      return renderDashboard()
  }
}

function renderConsole() {
  return `
    <div class="app-shell">
      ${renderTopbar()}
      ${renderFlash()}
      <div class="layout">
        ${renderSidebar()}
        <main class="main">
          ${renderActiveTab()}
        </main>
      </div>
    </div>
  `
}

function render() {
  document.documentElement.lang = state.locale
  document.title = `ourHangout Guardian Console | ${t(`tab_${state.activeTab}_title`)}`
  app.innerHTML = state.session ? renderConsole() : renderLogin()
}

function startEditUser(userId) {
  const user = state.users.find((item) => item.id === userId)
  if (!user) return

  state.editDraft = {
    id: user.id,
    role: user.role,
    displayName: user.displayName || '',
    effectiveName: user.effectiveName,
    statusMessage: user.statusMessage || '',
    phoneE164: user.phoneE164 || '',
    locale: user.locale || ''
  }
  state.activeTab = 'users'
  render()
}

async function refreshCurrentTab() {
  if (state.activeTab === 'dashboard') {
    await loadDashboard()
    return
  }

  if (state.activeTab === 'users') {
    await loadUsers()
    return
  }

  if (state.activeTab === 'rooms') {
    await loadRooms()
    return
  }

  if (state.activeTab === 'updates') {
    await loadAppUpdates()
    return
  }

  await loadStorage()
}

app.addEventListener('click', async (event) => {
  const target = event.target.closest(
    '[data-tab],[data-action],[data-set-locale],[data-edit-user],[data-revoke-user],[data-select-room],[data-delete-message],[data-delete-asset],[data-delete-release],[data-view-location],[data-refresh-location],[data-open-location]'
  )
  if (!target) return

  try {
    clearFlash()

    if (target.dataset.setLocale) {
      setLocale(target.dataset.setLocale)
      render()
      return
    }

    if (target.dataset.tab) {
      state.activeTab = target.dataset.tab
      render()
      return
    }

    if (target.dataset.editUser) {
      startEditUser(target.dataset.editUser)
      return
    }

    if (target.dataset.revokeUser) {
      if (!window.confirm(t('confirm_revoke_sessions'))) return
      const result = await apiRequest(`/v1/guardian/users/${target.dataset.revokeUser}/revoke-sessions`, {
        method: 'POST'
      })
      setFlash('info', result.revoked ? t('flash_sessions_revoked') : t('flash_no_active_sessions'))
      return
    }

    if (target.dataset.viewLocation) {
      startEditUser(target.dataset.viewLocation)
      const result = await loadUserLocation(target.dataset.viewLocation)
      if (!result.sharingEnabled) {
        setFlash('info', t('flash_location_disabled'))
        return
      }
      if (result.location) {
        render()
      } else {
        setFlash('info', t('flash_location_missing'))
      }
      return
    }

    if (target.dataset.refreshLocation) {
      const result = await apiRequest(`/v1/guardian/users/${target.dataset.refreshLocation}/location/refresh`, {
        method: 'POST'
      })
      setFlash('info', t('flash_precise_refresh_requested', { time: formatDate(result.expiresAt) }))
      return
    }

    if (target.dataset.openLocation) {
      const payload = state.userLocations[target.dataset.openLocation]
      if (payload?.location) {
        const { latitude, longitude } = payload.location
        window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, '_blank', 'noopener')
      }
      return
    }

    if (target.dataset.selectRoom) {
      state.selectedRoomId = target.dataset.selectRoom
      await loadRoomMessages({ reset: true })
      return
    }

    if (target.dataset.deleteMessage) {
      if (!window.confirm(t('confirm_delete_message'))) return
      await apiRequest(`/v1/guardian/messages/${target.dataset.deleteMessage}`, {
        method: 'DELETE'
      })
      setFlash('info', t('flash_message_deleted'))
      await Promise.all([loadRooms(), loadDashboard()])
      return
    }

    if (target.dataset.deleteAsset) {
      const messageRefs = Number(target.dataset.messageRefs || '0')
      const avatarRef = target.dataset.avatarRef === '1'

      if (messageRefs > 0) {
        setFlash('error', t('asset_still_referenced'))
        return
      }

      let forceAvatarDetach = false
      if (avatarRef) {
        forceAvatarDetach = window.confirm(t('confirm_clear_avatar'))
        if (!forceAvatarDetach) return
      }

      if (!window.confirm(t('confirm_delete_asset'))) return

      await apiRequest(
        `/v1/guardian/storage/assets/${target.dataset.deleteAsset}${buildQuery({ forceAvatarDetach })}`,
        {
          method: 'DELETE'
        }
      )
      setFlash('info', t('flash_asset_deleted'))
      await Promise.all([loadStorage(), loadDashboard(), loadUsers()])
      return
    }

    if (target.dataset.deleteRelease) {
      if (!window.confirm(t('confirm_delete_release'))) return
      const result = await apiRequest(`/v1/guardian/app-updates/${encodeURIComponent(target.dataset.deleteRelease)}`, {
        method: 'DELETE'
      })
      setFlash('info', t('flash_release_deleted', { version: result.version || target.dataset.deleteRelease }))
      await loadAppUpdates()
      return
    }

    switch (target.dataset.action) {
      case 'logout':
        clearSession()
        clearFlash()
        render()
        return
      case 'refresh-current':
        await refreshCurrentTab()
        return
      case 'refresh-users':
        await loadUsers()
        return
      case 'refresh-rooms':
        await loadRooms()
        return
      case 'refresh-room-messages':
        await loadRoomMessages({ reset: true })
        return
      case 'refresh-storage':
        await loadStorage()
        return
      case 'refresh-updates':
        await loadAppUpdates()
        return
      case 'cancel-edit':
        state.editDraft = null
        render()
        return
      case 'load-older':
        await loadRoomMessages({ reset: false })
        return
      case 'cleanup-orphans':
        if (!window.confirm(t('confirm_delete_orphans'))) return
        const cleanup = await apiRequest('/v1/guardian/storage/cleanup-orphans', {
          method: 'POST'
        })
        setFlash('info', t('flash_orphans_deleted', { count: cleanup.deletedCount, bytes: formatBytes(cleanup.freedBytes) }))
        await Promise.all([loadStorage(), loadDashboard()])
        return
      default:
        return
    }
  } catch (error) {
    setFlash('error', error.message || t('action_failed'))
  }
})

app.addEventListener('submit', async (event) => {
  event.preventDefault()

  const form = event.target
  if (!(form instanceof HTMLFormElement)) return

  try {
    clearFlash()

    if (form.id === 'guardian-login-form') {
      const formData = new FormData(form)
      state.loginForm = {
        loginId: String(formData.get('loginId') || '').trim(),
        password: String(formData.get('password') || '')
      }
      await loginWithPassword(state.loginForm.loginId, state.loginForm.password)
      state.loginForm.password = ''
      return
    }

    if (form.id === 'user-filter-form') {
      const formData = new FormData(form)
      state.filters.users = {
        q: String(formData.get('q') || ''),
        role: String(formData.get('role') || ''),
        limit: Number(formData.get('limit') || 100)
      }
      await loadUsers()
      return
    }

    if (form.id === 'user-edit-form') {
      const formData = new FormData(form)
      const userId = String(formData.get('userId') || '')
      await apiRequest(`/v1/guardian/users/${userId}`, {
        method: 'PATCH',
        body: {
          role: String(formData.get('role') || 'user'),
          displayName: String(formData.get('displayName') || ''),
          statusMessage: String(formData.get('statusMessage') || ''),
          phoneE164: String(formData.get('phoneE164') || ''),
          locale: String(formData.get('locale') || '')
        }
      })
      state.editDraft = null
      setFlash('info', t('flash_user_updated'))
      await Promise.all([loadUsers(), loadDashboard(), loadRooms()])
      return
    }

    if (form.id === 'room-filter-form') {
      const formData = new FormData(form)
      state.filters.rooms = {
        type: String(formData.get('type') || ''),
        memberUserId: String(formData.get('memberUserId') || ''),
        q: String(formData.get('q') || ''),
        limit: Number(formData.get('limit') || 60)
      }
      await loadRooms()
      return
    }

    if (form.id === 'bulk-delete-form') {
      const formData = new FormData(form)
      const rawBefore = String(formData.get('before') || '')
      const mode = event.submitter?.value || 'preview'

      state.filters.bulkDelete = {
        searchText: String(formData.get('searchText') || ''),
        roomId: String(formData.get('roomId') || ''),
        senderId: String(formData.get('senderId') || ''),
        before: rawBefore,
        kinds: formData.getAll('kinds').map((value) => String(value)),
        limit: Number(formData.get('limit') || 80)
      }

      if (mode === 'delete' && !window.confirm(t('confirm_delete_matches'))) return

      const result = await apiRequest('/v1/guardian/messages/bulk-delete', {
        method: 'POST',
        body: {
          searchText: state.filters.bulkDelete.searchText,
          roomId: state.filters.bulkDelete.roomId || undefined,
          senderId: state.filters.bulkDelete.senderId || undefined,
          before: rawBefore ? new Date(rawBefore).toISOString() : undefined,
          kinds: state.filters.bulkDelete.kinds,
          limit: state.filters.bulkDelete.limit,
          dryRun: mode !== 'delete'
        }
      })

      state.bulkDeletePreview = result
      if (result.deletedCount > 0) {
        setFlash('info', t('messages_deleted_count', { count: result.deletedCount }))
        await Promise.all([loadRooms(), loadDashboard()])
      } else {
        render()
      }
      return
    }

    if (form.id === 'storage-filter-form') {
      const formData = new FormData(form)
      state.filters.storage = {
        ownerUserId: String(formData.get('ownerUserId') || ''),
        status: String(formData.get('status') || ''),
        unreferencedOnly: formData.get('unreferencedOnly') === 'on',
        limit: Number(formData.get('limit') || 80)
      }
      await loadStorage()
      return
    }

    if (form.id === 'app-updates-upload-form') {
      const formData = new FormData(form)
      const version = String(formData.get('version') || '').trim()
      const notes = String(formData.get('notes') || '').trim()
      const file = formData.get('apkFile')

      if (!(file instanceof File) || file.size <= 0) {
        throw new Error(t('app_update_file_required'))
      }

      state.loading.updateUpload = true
      render()

      try {
        const result = await apiRequest('/v1/guardian/app-updates', {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/vnd.android.package-archive',
            'X-App-Version': version,
            'X-App-Notes': notes,
            'X-App-File-Name': file.name
          },
          body: file
        })

        setFlash('info', t('app_update_uploaded', { version: result.version || version }))
        await loadAppUpdates()
      } finally {
        state.loading.updateUpload = false
        render()
      }
    }
  } catch (error) {
    setFlash('error', error.message || t('action_failed'))
  }
})

async function bootstrap() {
  render()

  try {
    if (!state.session) return

    await loadAllData()
  } catch (error) {
    clearSession()
    setFlash('error', error.message || t('session_validation_failed'))
  }
}

bootstrap()
