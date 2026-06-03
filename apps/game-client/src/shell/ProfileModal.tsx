import type { ClientSeasonMedalCabinet } from '@trinitywar/shared';

interface ProfileModalProps {
  avatarInitial: string;
  medalCabinet: ClientSeasonMedalCabinet | null;
  nickname: string;
  open: boolean;
  onClose: () => void;
}

export function ProfileModal(props: ProfileModalProps): JSX.Element | null {
  if (!props.open) {
    return null;
  }

  return (
    <div className="modal-backdrop modal-backdrop-blocking" role="presentation">
      <section className="modal-card app-dialog profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <header className="app-dialog-head">
          <div className="app-dialog-title">
            <p className="eyebrow">个人资料</p>
            <h3 id="profile-modal-title">{props.nickname}</h3>
          </div>
          <button className="app-dialog-close" aria-label="关闭" onClick={props.onClose} type="button">×</button>
        </header>

        <div className="app-dialog-body profile-dialog-body">
          <div className="profile-summary">
            <button className="profile-avatar-large" type="button" aria-label="更换头像占位">
              {props.avatarInitial}
            </button>
            <div>
              <strong>{props.nickname}</strong>
              <p className="profile-modal-note">头像、昵称和个人展示信息后续在这里维护，不和系统设置混在一起。</p>
            </div>
          </div>

          <div className="profile-edit-placeholder">
            <button className="secondary-button small" type="button" disabled>设置头像</button>
            <button className="secondary-button small" type="button" disabled>修改昵称</button>
          </div>

          <div className="profile-medal-section">
            <div className="profile-section-head">
              <h4>{props.medalCabinet?.currentSeasonTitle ?? '赛季奖章陈列柜'}</h4>
              <span>{props.medalCabinet?.medals.length ?? 0} 枚</span>
            </div>
            {props.medalCabinet ? (
              <div className="profile-season-list">
                {props.medalCabinet.medalsBySeason.map((season) => (
                  <article className="profile-season-card" key={season.seasonNumber}>
                    <div className="profile-season-title">
                      <strong>{season.title}</strong>
                      <span>{season.medals.length} 枚</span>
                    </div>
                    {season.medals.length <= 0 ? (
                      <p className="profile-empty-text">本赛季暂未获得奖章。</p>
                    ) : (
                      <div className="profile-medal-grid">
                        {season.medals.map((medal) => (
                          <div className="profile-medal-card" key={medal.id}>
                            <span>{getDomainLabel(medal.domain)}</span>
                            <strong>{medal.title}</strong>
                            {medal.titleEn ? <em>{medal.titleEn}</em> : null}
                            <p>{medal.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="profile-empty-text">正在读取奖章陈列柜。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function getDomainLabel(domain: string): string {
  if (domain === 'farming') {
    return '种田';
  }
  if (domain === 'spirit') {
    return '养宠';
  }
  if (domain === 'combat') {
    return '探索战斗';
  }
  if (domain === 'contribution') {
    return '贡献';
  }
  return domain;
}
