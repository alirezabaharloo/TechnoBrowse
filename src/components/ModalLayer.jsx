
import ProfileFormModal from './ProfileFormModal';
import DeleteProfileModal from './DeleteProfileModal';
import Toasts from './Toasts';

export default function ModalLayer({
  modal,
  setModal,
  handleCreate,
  handleEdit,
  handleDelete,
  toasts,
  dismissToast,
}) {
  return (
    <>
      {modal?.type === 'create' && (
        <ProfileFormModal
          mode="create"
          onClose={() => setModal(null)}
          onSubmit={handleCreate}
        />
      )}

      {modal?.type === 'edit' && (
        <ProfileFormModal
          mode="edit"
          initialProfile={modal.profile}
          onClose={() => setModal(null)}
          onSubmit={handleEdit}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteProfileModal
          profile={modal.profile}
          onClose={() => setModal(null)}
          onConfirm={handleDelete}
        />
      )}

      <Toasts toasts={toasts} dismiss={dismissToast} />
    </>
  );
}
